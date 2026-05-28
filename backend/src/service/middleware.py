import os

from langchain.agents.middleware import (
    ModelCallLimitMiddleware,
    SummarizationMiddleware,
    ToolCallLimitMiddleware,
)
from langchain.agents.middleware.types import AgentMiddleware
from langchain_core.messages import RemoveMessage
from langchain_groq import ChatGroq

from src.service.prompts import summarization_prompt


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
        model=ChatGroq(
            model=os.getenv("SUMMARIZATION_MODEL", "llama-3.3-70b-versatile")
        ),
        trigger=[("messages", 10), ("tokens", 6000)],
        keep=("messages", 8),
        summarization_prompt=summarization_prompt,
    )

    # Caps the LLM thinking loops (e.g. LLM getting confused and talking to itself)
    call_tracker = ModelCallLimitMiddleware(
        thread_limit=50,
        run_limit=6,  # Slightly higher than tool limit to allow a final synthesis call
        exit_behavior="end",
    )

    # Caps the actual tool execution (RAG searches, MCP actions)
    tool_tracker = ToolCallLimitMiddleware(
        thread_limit=50,
        run_limit=5,  # Your ideal 5 calls per "round"
        exit_behavior="continue",  # Forces the LLM to summarize its failures rather than crashing
    )

    orphan_cleaner = CleanToolMessagesMiddleware()

    # Order matters: Clean orphans first, track limits, then summarize if needed
    return [orphan_cleaner, tool_tracker, call_tracker, summarization]
