from langchain.agents.middleware import (
    ModelCallLimitMiddleware,
    SummarizationMiddleware,
    ToolCallLimitMiddleware,
    wrap_tool_call,
)
from langchain.agents.middleware.types import AgentMiddleware
from langchain_core.messages import RemoveMessage, ToolMessage
from langchain_groq import ChatGroq

from src.config.settings import settings
from src.service.prompts import summarization_prompt


# Example: Using @wrap_tool_call middleware to intercept and return error ToolMessages
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


def middleware_setup():
    summarization = SummarizationMiddleware(
        model=ChatGroq(model=settings.summarization_llm),
        trigger=[
            ("messages", settings.message_limit),
            ("tokens", settings.token_limit),
        ],
        keep=("messages", settings.keep_message_limit),
        summarization_prompt=summarization_prompt,
    )

    call_tracker = ModelCallLimitMiddleware(
        thread_limit=settings.model_thread_limit,
        run_limit=settings.model_run_limit,
        exit_behavior=settings.model_exit_behavior,
    )

    tool_tracker = ToolCallLimitMiddleware(
        thread_limit=settings.tool_thread_limit,
        run_limit=settings.tool_run_limit,
        exit_behavior=settings.tool_exit_behaviour,
    )

    orphan_cleaner = CleanToolMessagesMiddleware()

    return [
        handle_tool_errors,
        orphan_cleaner,
        tool_tracker,
        call_tracker,
        summarization,
    ]
