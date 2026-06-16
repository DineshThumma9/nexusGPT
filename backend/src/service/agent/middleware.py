from langchain.agents.middleware import (
    ModelCallLimitMiddleware,
    SummarizationMiddleware,
    ToolCallLimitMiddleware,
    wrap_tool_call,
)
from langchain.agents.middleware.types import AgentMiddleware
from langchain_core.messages import AIMessage, RemoveMessage, ToolMessage
from langchain_groq import ChatGroq

from src.config.settings import settings
from src.models.enums import ThinkingLevel
from src.service.agent.prompts import summarization_prompt


@wrap_tool_call
async def handle_tool_errors(request, handler):
    try:
        return await handler(request)
    except Exception as error:
        return ToolMessage(
            content=f"Error: {str(error)}",
            tool_call_id=request.tool_call["id"],
            status="error",
        )


class CleanToolMessagesMiddleware(AgentMiddleware):
    """
    Cleans up orphaned ToolMessages that lost their parent AIMessage
    due to context window summarization. This prevents strict APIs like
    Mistral from crashing with a 400 Bad Request error.
    """

    def before_model(self, state, runtime):
        messages = state.get("messages", [])
        if not messages:
            return None

        ai_tool_call_ids = set()
        for msg in messages:
            if msg.type == "ai" and getattr(msg, "tool_calls", None):
                for tc in msg.tool_calls:
                    if tc.get("id"):
                        ai_tool_call_ids.add(tc["id"])

        to_remove = []
        for msg in messages:
            if msg.type == "tool":
                if getattr(msg, "tool_call_id", None) not in ai_tool_call_ids:
                    if hasattr(msg, "id") and msg.id:
                        to_remove.append(RemoveMessage(id=msg.id))

        if to_remove:
            return {"messages": to_remove}
        return None


class SanitizeMessagesMiddleware(AgentMiddleware):
    """
    Sanitizes AIMessage content to ensure it is a string when it contains a list of blocks.
    This prevents strict APIs like Mistral from crashing with a 422 Unprocessable Entity
    due to unexpected dictionary keys like 'extras' in the content block.
    """

    def before_model(self, state, runtime):
        messages = state.get("messages", [])
        if not messages:
            return None

        updates = []
        for msg in messages:
            if msg.type == "ai" and isinstance(msg.content, list):
                new_content = ""
                for block in msg.content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        new_content += block.get("text", "")
                    elif isinstance(block, str):
                        new_content += block

                new_msg = AIMessage(
                    content=new_content,
                    id=msg.id,
                    tool_calls=getattr(msg, "tool_calls", []),
                    invalid_tool_calls=getattr(msg, "invalid_tool_calls", []),
                    additional_kwargs=getattr(msg, "additional_kwargs", {}),
                    response_metadata=getattr(msg, "response_metadata", {}),
                )
                updates.append(new_msg)

        if updates:
            return {"messages": updates}
        return None


def middleware_setup(thinking_level: ThinkingLevel = ThinkingLevel.MEDIUM):
    if not isinstance(thinking_level, ThinkingLevel):
        try:
            thinking_level = ThinkingLevel[thinking_level.upper()]
        except (KeyError, AttributeError):
            thinking_level = ThinkingLevel.MEDIUM

    thinking_config = thinking_level.value
    summarization = SummarizationMiddleware(
        model=ChatGroq(model=settings.summarization_llm),
        trigger=[
            ("messages", thinking_config.message_limit),
            ("tokens", thinking_config.token_limit),
        ],
        keep=("messages", thinking_config.keep_message_limit),
        summarization_prompt=summarization_prompt,
    )

    call_tracker = ModelCallLimitMiddleware(
        thread_limit=thinking_config.model_thread_limit,
        run_limit=thinking_config.model_run_limit,
        exit_behavior=settings.model_exit_behavior,
    )

    tool_tracker = ToolCallLimitMiddleware(
        thread_limit=thinking_config.tool_thread_limit,
        run_limit=thinking_config.tool_run_limit,
        exit_behavior=settings.tool_exit_behaviour,
    )

    orphan_cleaner = CleanToolMessagesMiddleware()
    sanitizer = SanitizeMessagesMiddleware()

    return [
        handle_tool_errors,
        sanitizer,
        orphan_cleaner,
        tool_tracker,
        call_tracker,
        summarization,
    ]
