import asyncio
import json
import time
from collections import OrderedDict
from typing import Any, Dict, List, Optional

from langchain_mcp_adapters.client import MultiServerMCPClient
from loguru import logger
from sqlalchemy import select

from src.db.dbs import AsyncSessionLocal, _init_db
from src.db.redisdb import aredis as redis_client
from src.models.models import UserMCPConfig
from src.service.crypto import CryptoService


class AsyncLRUCache:
    def __init__(self, maxsize: int = 100):
        self.cache: OrderedDict[str, Any] = OrderedDict()
        self.maxsize = maxsize

    def get(self, key: str) -> Any:
        if key in self.cache:
            self.cache.move_to_end(key)
            return self.cache[key]
        return None

    def set(self, key: str, value: Any) -> None:
        if key in self.cache:
            self.cache.move_to_end(key)
        self.cache[key] = value
        if len(self.cache) > self.maxsize:
            _, evicted_item = self.cache.popitem(last=False)
            self._close_client_safely(evicted_item.get("client"))

    def delete(self, key: str) -> None:
        if key in self.cache:
            item = self.cache.pop(key)
            self._close_client_safely(item.get("client"))

    def _close_client_safely(self, client: Optional[MultiServerMCPClient]) -> None:
        if not client:
            return
        try:
            loop = asyncio.get_running_loop()
            if hasattr(client, "close"):
                loop.create_task(client.close())
        except Exception as e:
            logger.error(f"Error scheduling MCP client closure: {e}")


_MCP_CLIENT_CACHE = AsyncLRUCache(maxsize=50)


class MCPService:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.client: Optional[MultiServerMCPClient] = None
        self.client_config: Optional[Dict[str, Any]] = None
        self.crypto = CryptoService()

    async def _initialize(self) -> None:
        """Fetch config from cache/DB and initialize MultiServerMCPClient."""
        if self.client is not None:
            return

        logger.info(f"Initializing MCPService for user {self.user_id}")
        start = time.time()
        cache_key = f"mcp_config_client:{self.user_id}"
        cached_config = await redis_client.get(cache_key)

        if cached_config:
            client_config = json.loads(cached_config)
            # Handle old cache format gracefully
            if "mcpServers" in client_config:
                client_config = client_config["mcpServers"]
            logger.info(
                f"Retrieved MCP configs from Redis in {time.time() - start:.2f}s"
            )
        else:
            _init_db()
            async with AsyncSessionLocal() as db:
                stmt = select(UserMCPConfig).where(
                    UserMCPConfig.user_id == self.user_id
                )
                result = await db.execute(stmt)
                user_mcp_configs = result.scalars().all()
                if not user_mcp_configs:
                    self.client_config = {}
                    return

                client_config = {}
                for i, config in enumerate(user_mcp_configs):
                    if not getattr(config, "is_active", False):
                        continue
                    # create a simple server name
                    server_name = f"mcp_server_{i}"
                    server_cfg = {
                        "transport": config.type,
                        "url": config.server_url,
                    }
                    if config.auth_header and config.api_key:
                        server_cfg["headers"] = {config.auth_header: config.api_key}
                    client_config[server_name] = server_cfg

                await redis_client.set(cache_key, json.dumps(client_config), ex=60 * 5)
                logger.info(
                    f"Retrieved MCP configs from DB in {time.time() - start:.2f}s"
                )

        for server_name, server_config in client_config.items():
            # Migrate old cache entries dynamically
            if "transport" not in server_config:
                server_config["transport"] = "http"
            if "env" in server_config and "headers" not in server_config:
                server_config["headers"] = server_config.pop("env")

            if "headers" in server_config:
                for key, val in server_config["headers"].items():
                    try:
                        server_config["headers"][key] = self.crypto.decrypt(val)
                    except Exception:
                        pass

        # Check cache for existing connection
        config_str = json.dumps(client_config, sort_keys=True)
        cached_item = _MCP_CLIENT_CACHE.get(self.user_id)
        if cached_item:
            if cached_item["config_str"] == config_str:
                logger.info(f"Reusing existing MCP client for user {self.user_id}")
                self.client = cached_item["client"]
                self.client_config = client_config
                return
            else:
                _MCP_CLIENT_CACHE.delete(self.user_id)

        self.client_config = client_config
        self.client = MultiServerMCPClient(client_config)

        _MCP_CLIENT_CACHE.set(
            self.user_id,
            {
                "config_str": config_str,
                "client": self.client,
            },
        )

    async def load_tools(self) -> List[Any]:
        """Load tools from all MCP servers."""
        await self._initialize()
        if not self.client or not self.client_config:
            return []

        try:
            tools = await self.client.get_tools()
            if len(tools) > 75:
                logger.warning(f"Restricting {len(tools)} tools to 75 limit")
                tools = tools[:75]
            else:
                logger.info(f"Loaded {len(tools)} tools from MCP")
            return tools
        except Exception as e:
            logger.error(f"Failed to load MCP tools: {e}")
            return []

    async def get_tools_count(self) -> dict:
        """Get the total available tools and the restricted count."""
        await self._initialize()
        if not self.client or not self.client_config:
            return {"total_available": 0, "active": 0}

        try:
            tools = await self.client.get_tools()
            return {"total_available": len(tools), "active": min(len(tools), 75)}
        except Exception as e:
            logger.error(f"Failed to load MCP tools for count: {e}")
            return {"total_available": 0, "active": 0}

    async def list_resources(self) -> List[Any]:
        """Fetch all resource lists from all configured servers."""
        await self._initialize()
        if not self.client or not self.client_config:
            return []

        all_resources = []
        try:
            for server_name in self.client_config.keys():
                async with self.client.session(server_name) as session:
                    resources_list = await session.list_resources()
                    all_resources.extend(resources_list.resources)
            logger.info(f"Listed {len(all_resources)} resources from MCP")
            return all_resources
        except Exception as e:
            logger.error(f"Failed to list MCP resources: {e}")
            return []

    async def read_resource(self, uri: str, server_name: Optional[str] = None) -> Any:
        """Read a specific resource by URI."""
        await self._initialize()
        if not self.client or not self.client_config:
            return None

        try:
            resources = await self.client.get_resources(
                server_name=server_name, uris=[uri]
            )
            if resources:
                return resources[0]
            return None
        except Exception as e:
            logger.error(f"Failed to read MCP resource {uri}: {e}")
            return None

    async def load_prompts(self) -> List[Any]:
        """Load prompts from all MCP servers."""
        await self._initialize()
        if not self.client or not self.client_config:
            return []

        all_prompts = []
        try:
            for server_name in self.client_config.keys():
                async with self.client.session(server_name) as session:
                    prompts_list = await session.list_prompts()
                    all_prompts.extend(prompts_list.prompts)
            logger.info(f"Loaded {len(all_prompts)} prompts from MCP")
            return all_prompts
        except Exception as e:
            logger.error(f"Failed to load MCP prompts: {e}")
            return []
