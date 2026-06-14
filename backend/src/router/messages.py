import json
from collections import defaultdict

from fastapi import APIRouter, Body, Depends, Request
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage
from langchain_core.messages.ai import AIMessageChunk
from loguru import logger

from ..db.dbs import get_db
from ..models.enums import SenderRole
from ..models.schema import MessageRequest
from ..router.limiter import limiter
from ..service.agent_service import AgentService
from ..service.auth_service import get_current_user
from ..service.chat_service import ChatService

router = APIRouter()


@router.post("/simple-stream")
@limiter.limit("20/minute")
async def message_stream(
    request: Request,
    body: MessageRequest = Body(...),
    db=Depends(get_db),
    user=Depends(get_current_user),
):
    agent_object = AgentService(db=db, user=user, session_id=body.session_id)
    agent = await agent_object.build(msg=body.msg, mcp_enabled=body.mcp_enabled)

    config = defaultdict(dict)
    config["configurable"]["thread_id"] = str(body.session_id)
    config["metadata"]["user_id"] = str(user.userid)
    config["metadata"]["session_id"] = str(body.session_id)

    return StreamingResponse(
        _stream(agent, body.msg, config, request, str(body.session_id), db),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _stream(
    agent, message: str, config: dict, request: Request, session_id: str, db
):

    chat_obj = ChatService(db=db)
    await chat_obj.add_message(session_id, SenderRole.USER, message)
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

            if hasattr(msg_chunk, "tool_call_chunks") and msg_chunk.tool_call_chunks:
                continue

            if hasattr(msg_chunk, "content") and msg_chunk.content:
                if isinstance(msg_chunk, AIMessageChunk):
                    if (
                        _meta.get("langgraph_node") == "model"
                    ):  # Only stream output from the main agent, ignoring background middleware/summarizers
                        # Gemini / Claude return content as a list of typed blocks
                        if isinstance(msg_chunk.content, list):
                            token = "".join(
                                block.get("text", "")
                                for block in msg_chunk.content
                                if isinstance(block, dict)
                                and block.get("type") == "text"
                            )
                        else:
                            token = msg_chunk.content  # plain string (OpenAI-style)

                        if token:
                            full += token
                            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

    except Exception as e:
        logger.error(f"Stream error: {e}")
        yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
        return

    await chat_obj.add_message(session_id, SenderRole.ASSISTANT, full)

    yield f"data: {json.dumps({'type': 'done', 'content': full})}\n\n"
