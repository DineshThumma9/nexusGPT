import json
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage
from loguru import logger

from src.db.dbs import get_checkpointer, get_db
from src.db.neo4j import get_graph
from src.db.qdrant_client import get_user_vector_db
from src.models.models import KnowledgeBase, Session
from src.models.schema import MessageRequest
from src.router.auth import get_current_user
from src.service.set_up_service import build_agent, get_llm_instance
from src.service.tools import make_tools

from langchain_core.messages.ai import AIMessageChunk


router = APIRouter()


@router.post("/simple-stream")
async def message_stream(
    request: Request,
    body: MessageRequest = Body(...),
    db=Depends(get_db),
    user=Depends(get_current_user),
):
    # 1. Look up the session → get kb_id (may be None for vanilla)
    session = db.query(Session).filter_by(session_id=body.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if str(session.user_id) != str(user.userid):
        raise HTTPException(status_code=403, detail="Forbidden")

    kb_id: UUID | None = session.kb_id  # None = no RAG context attached
    source_type = "github"

    # 2. Build tools — if no kb_id, empty list → agent answers from LLM only
    if kb_id is not None:
        kb = db.query(KnowledgeBase).filter_by(kb_id=kb_id).first()
        if kb:
            # Prevent querying a Knowledge Base that is still indexing
            kb_status = (
                kb.status.value if hasattr(kb.status, "value") else str(kb.status)
            )
            if kb_status.lower() != "ready":
                raise HTTPException(
                    status_code=400,
                    detail=f"Knowledge Base is currently {kb_status.lower()}. Please wait until processing is complete.",
                )

            source_type = (
                kb.source_type.value
                if hasattr(kb.source_type, "value")
                else str(kb.source_type)
            )
        ns = str(kb_id)  # str(UUID) is the universal namespace key
        vector_db = get_user_vector_db(
            ns, source_type=source_type
        )  # Qdrant filter: payload.kb_id == ns
        tools = await make_tools(
            vector_db=vector_db,
            neo4j_ns=ns,
            graph_obj=get_graph(),
            source_type=source_type,
        )
    else:
        tools = []

    # 3. LLM from user's configured provider/model
    llm = get_llm_instance(db=db, user=user)

    # 4. Compile agent — tools are per-request (correct), checkpointer is global singleton
    checkpointer = get_checkpointer()
    agent = build_agent(
        llm=llm,
        tools=tools,
        checkpointer=checkpointer,
        source_type=source_type if kb_id else None,
        source_ref=kb.source_ref if (kb_id and kb) else None,
    )

    # 5. thread_id = session_id UUID — this is LangGraph's conversation memory key
    config = {"configurable": {"thread_id": str(body.session_id)}}

    return StreamingResponse(
        _stream(agent, body.msg, config, request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )




async def _stream(agent, message: str, config: dict, request: Request):
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
            if hasattr(msg_chunk, "content") and msg_chunk.content:
                # LangGraph might yield HumanMessageChunk or ToolMessageChunk too.
                # Check if it's an AI message, and if its content is a string.
                if isinstance(msg_chunk, AIMessageChunk) and isinstance(msg_chunk.content, str):
                    token = msg_chunk.content
                    full += token
                    yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
    except Exception as e:
        logger.error(f"Stream error: {e}")
        yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
        return
    yield f"data: {json.dumps({'type': 'done', 'content': full})}\n\n"
