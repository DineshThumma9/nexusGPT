import json

from fastapi import APIRouter, Body, Depends, Request
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage
from langchain_core.messages.ai import AIMessageChunk
from loguru import logger

from src.db.dbs import get_db
from src.models.enums import SenderRole
from src.models.schema import MessageRequest
from src.router.auth import get_current_user
from src.router.limiter import limiter
from src.service.db_service import add_message
from src.service.setup_service import setup_agent_for_session

router = APIRouter()


@router.post("/simple-stream")
@limiter.limit("20/minute")
async def message_stream(
    request: Request,
    body: MessageRequest = Body(...),
    db=Depends(get_db),
    user=Depends(get_current_user),
):
    agent = await setup_agent_for_session(db, body.session_id, user, body.msg)

    config = {
        "configurable": {"thread_id": str(body.session_id)},
        "metadata": {
            "user_id": str(user.userid),
            "session_id": str(body.session_id),
        },
    }

    return StreamingResponse(
        _stream(agent, body.msg, config, request, str(body.session_id), db),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _stream(
    agent, message: str, config: dict, request: Request, session_id: str, db
):

    await add_message(db, session_id, SenderRole.USER, message)
    yield f"data: {json.dumps({'type': 'start', 'content': ''})}\n\n"
    full = ""
    try:
        async for chunk in agent.astream(
            {"messages": [HumanMessage(content=message)]},
            config=config,
            stream_mode="messages",
        ):
            if await request.is_disconnected():
                break

            msg_chunk, _meta = chunk

            msg_content, _meta = chunk
            # print(f"Hello I am meta:{_meta.get('langgraph_node')} | Type: {type(msg_chunk).__name__} ")

            if hasattr(msg_chunk, "tool_call_chunks") and msg_chunk.tool_call_chunks:
                continue

            if hasattr(msg_chunk, "content") and msg_chunk.content:
                if isinstance(msg_chunk, AIMessageChunk) and isinstance(
                    msg_chunk.content, str
                ):
                    if (
                        _meta.get("langgraph_node") == "model"
                    ):  # Only stream output from the main agent, ignoring background middleware/summarizers
                        token = msg_chunk.content
                        full += token
                        yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

    except Exception as e:
        logger.error(f"Stream error: {e}")
        yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
        return

    await add_message(db, session_id, SenderRole.ASSISTANT, full)

    yield f"data: {json.dumps({'type': 'done', 'content': full})}\n\n"
