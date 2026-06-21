from langchain_community.tools import DuckDuckGoSearchRun
from langchain_core.language_models import BaseChatModel

class GenericTools:
    def __init__(
        self,
        user_id: str,
        llm: BaseChatModel | None = None,
    ):
        self.user_id = user_id
        self.llm = llm
        self.tools: list = []

    @classmethod
    async def build(
        cls,
        user_id: str,
        llm: BaseChatModel | None = None,
    ) -> "GenericTools":
        instance = cls(user_id, llm)
        instance.tools = [
            DuckDuckGoSearchRun(),
        ]
        return instance
