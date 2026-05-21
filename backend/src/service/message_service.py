import os

from fastapi import APIRouter
from langchain_groq import ChatGroq as Groq
from loguru import logger

router = APIRouter()


from src.service.prompt import prompt_template


async def session_title_gen(query):
    try:
        title_gen = Groq(model="compound-beta", api_key=os.getenv("GROQ_API_KEY"))

        session_title = await title_gen.ainvoke(prompt_template.format(query=query))

        result = (
            session_title.content
            if hasattr(session_title, "content")
            else str(session_title)
        )

        if result:
            cleaned_title = result.strip().strip('"').strip("'")
            if cleaned_title and len(cleaned_title) > 0:
                return cleaned_title

        return "New Chat"

    except Exception as e:
        logger.error(f"Error in session_title_gen: {e}")
        return "New Chat"
