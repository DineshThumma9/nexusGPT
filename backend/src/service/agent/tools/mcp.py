from langchain_core.tools import StructuredTool

from src.service.agent.mcp import MCPService

class MCPTools:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.mcp_service: MCPService | None = None
        self.mcp_tools: list = []
        self.tools: list = []

    @classmethod
    async def build(
        cls,
        user_id: str,
        mcp_enabled: bool = True,
    ) -> "MCPTools":
        instance = cls(user_id)
        mcp_service = MCPService(user_id)
        instance.mcp_service = mcp_service

        if mcp_enabled:
            instance.mcp_tools = await mcp_service.load_tools()
        else:
            instance.mcp_tools = []

        instance.tools = [
            StructuredTool.from_function(
                coroutine=instance.list_mcp_resources,
                name="list_mcp_resources",
                description="List available resources from all configured MCP servers.",
            ),
            StructuredTool.from_function(
                coroutine=instance.read_mcp_resource,
                name="read_mcp_resource",
                description="Read a specific resource by URI from MCP servers.",
            ),
            StructuredTool.from_function(
                coroutine=instance.load_mcp_prompts,
                name="load_mcp_prompts",
                description="Load prompts from all configured MCP servers.",
            ),
            *instance.mcp_tools,
        ]

        return instance

    async def list_mcp_resources(self) -> str:
        """List available resources from all configured MCP servers."""
        if not self.mcp_service:
            return "MCP service not initialized."
        resources = await self.mcp_service.list_resources()
        if not resources:
            return "No MCP resources found."

        result = []
        for r in resources:
            try:
                res_dict = r.model_dump()
            except AttributeError:
                res_dict = (
                    dict(r)
                    if hasattr(r, "keys")
                    else {
                        "uri": getattr(r, "uri", str(r)),
                        "name": getattr(r, "name", ""),
                    }
                )
            result.append(
                f"URI: {res_dict.get('uri')} | Name: {res_dict.get('name')} | MimeType: {res_dict.get('mimeType')}"
            )
        return "\n".join(result)

    async def read_mcp_resource(self, uri: str, server_name: str | None = None) -> str:
        """Read a specific resource by URI from MCP servers."""
        if not self.mcp_service:
            return "MCP service not initialized."
        resource = await self.mcp_service.read_resource(uri, server_name)
        if not resource:
            return f"Resource {uri} not found or could not be read."
        try:
            return getattr(resource, "text", str(resource))
        except Exception as e:
            return f"Error reading resource content: {e}"

    async def load_mcp_prompts(self) -> str:
        """Load prompts from all configured MCP servers."""
        if not self.mcp_service:
            return "MCP service not initialized."
        prompts = await self.mcp_service.load_prompts()
        if not prompts:
            return "No MCP prompts found."

        result = []
        for p in prompts:
            try:
                p_dict = p.model_dump()
            except AttributeError:
                p_dict = (
                    dict(p)
                    if hasattr(p, "keys")
                    else {
                        "name": getattr(p, "name", str(p)),
                        "description": getattr(p, "description", ""),
                    }
                )
            result.append(
                f"Name: {p_dict.get('name')} | Description: {p_dict.get('description')}"
            )
        return "\n".join(result)
