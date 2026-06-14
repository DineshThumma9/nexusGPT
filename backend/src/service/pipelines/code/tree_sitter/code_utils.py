import httpx
from fastapi import HTTPException
from loguru import logger

from .....config.settings import settings
from .....models.schema import GitRequest
from .....service.constants import ALWAYS_SKIP, SKIP_DIRS, SKIP_EXTENSIONS


class RepoTooLargeError(Exception):
    """Raised when a repo exceeds the configured file/size limits."""


class CodeUtils:
    """Encapsulates GitHub repo inspection and file filtering for a given request."""

    GITHUB_API = "https://api.github.com"

    def __init__(self, req: GitRequest):
        self.req = req
        self.token = req.token or settings.github_token
        self._headers = {"Accept": "application/vnd.github+json"}
        if self.token:
            self._headers["Authorization"] = f"Bearer {self.token}"

    # Convenience so we don't repeat owner/repo everywhere
    @property
    def _repo_url(self) -> str:
        return f"{self.GITHUB_API}/repos/{self.req.owner}/{self.req.repo}"

    # ------------------------------------------------------------------
    # Filtering helpers
    # ------------------------------------------------------------------

    def _is_skipped(self, path: str) -> bool:
        """Returns True if the path should always be ignored."""
        filename = path.split("/")[-1]
        if filename in ALWAYS_SKIP:
            return True
        if any(path.startswith(d) or f"/{d}" in path for d in SKIP_DIRS):
            return True
        if any(filename.endswith(ext) for ext in SKIP_EXTENSIONS):
            return True
        return False

    def _is_processable(self, path: str) -> bool:
        """Returns True if the file passes all inclusion/exclusion filters on self.req."""
        if self._is_skipped(path):
            return False
        if self.req.file_extension_include and not any(
            path.endswith(ext) for ext in self.req.file_extension_include
        ):
            return False
        if self.req.file_extension_exclude and any(
            path.endswith(ext) for ext in self.req.file_extension_exclude
        ):
            return False
        if self.req.dir_exclude and any(
            path.startswith(d) or f"/{d}" in path for d in self.req.dir_exclude
        ):
            return False
        if self.req.dir_include and not any(
            path.startswith(d) or f"/{d}" in path for d in self.req.dir_include
        ):
            return False
        return True

    # ------------------------------------------------------------------
    # GitHub API helpers
    # ------------------------------------------------------------------

    async def _fetch_tree(self, ref: str) -> list:
        """Fetch the full Git tree for a repo ref via the GitHub API."""
        url = f"{self._repo_url}/git/trees/{ref}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                url, headers=self._headers, params={"recursive": "1"}
            )
        if resp.status_code == 404:
            raise RepoTooLargeError(
                f"Repository {self.req.owner}/{self.req.repo} "
                f"ref {ref!r} not found or not accessible."
            )
        resp.raise_for_status()
        body = resp.json()
        if body.get("truncated"):
            logger.warning(
                f"GitHub tree truncated for {self.req.owner}/{self.req.repo}"
                " — limits may be inaccurate."
            )
        return body.get("tree", [])

    # ------------------------------------------------------------------
    # Public methods
    # ------------------------------------------------------------------

    async def validate_and_get_commit_sha(self) -> tuple[str, str]:
        """Validates the repo and returns (commit_sha, resolved_ref)."""
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                meta = await client.get(self._repo_url, headers=self._headers)

                if meta.status_code in (404, 301):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Repository '{self.req.owner}/{self.req.repo}' not found or not accessible.",
                    )
                meta.raise_for_status()

                ref = (
                    self.req.commit or self.req.branch or meta.json()["default_branch"]
                )

                resp = await client.get(
                    f"{self._repo_url}/commits/{ref}",
                    headers=self._headers,
                )

            if resp.status_code != 200:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to fetch repo from GitHub: {resp.text}",
                )

            return resp.json()["sha"], ref

        except httpx.RequestError as exc:
            logger.error(f"GitHub API connection error: {exc}")
            raise HTTPException(
                status_code=503,
                detail="Failed to connect to GitHub. Please check your network or try again.",
            )

    async def enforce_repo_limits(self, ref: str) -> None:
        """Check repo file count and total size against configured limits.

        Uses the GitHub Git Trees API to enumerate the repo without cloning it.
        Raises RepoTooLargeError with a detailed message if any limit is exceeded.
        """
        tree = await self._fetch_tree(ref)

        raw_count = raw_size = processable_count = processable_size = 0

        for entry in tree:
            if entry.get("type") != "blob":
                continue
            path = entry.get("path", "")
            size = entry.get("size", 0) or 0
            raw_count += 1
            raw_size += size
            if self._is_processable(path):
                processable_count += 1
                processable_size += size

        raw_size_mb = raw_size / (1024 * 1024)
        proc_size_mb = processable_size / (1024 * 1024)

        if raw_count > settings.max_files_raw:
            raise RepoTooLargeError(
                f"Repository has {raw_count} files (raw), "
                f"over the {settings.max_files_raw} limit."
            )
        if raw_size_mb > settings.max_size_raw_mb:
            raise RepoTooLargeError(
                f"Repository size {raw_size_mb:.1f} MB (raw), "
                f"over the {settings.max_size_raw_mb} MB limit."
            )
        if processable_count > settings.max_files_processable:
            raise RepoTooLargeError(
                f"Repository has {processable_count} processable files "
                f"(of {raw_count} total), "
                f"over the {settings.max_files_processable} limit."
            )
        if proc_size_mb > settings.max_size_processable_mb:
            raise RepoTooLargeError(
                f"Repository processable content {proc_size_mb:.1f} MB, "
                f"over the {settings.max_size_processable_mb} MB limit."
            )

    def build_tree(self, tree_lis: list) -> list:
        """Convert a flat GitHub tree list into a nested directory structure."""
        root = {"name": "/", "type": "tree", "children": []}
        path_map = {"/": root}

        for item in tree_lis:
            parts = item["path"].split("/")
            for i in range(1, len(parts) + 1):
                sub_path = "/".join(parts[:i])
                if sub_path not in path_map:
                    parent_path = "/".join(parts[: i - 1]) or "/"
                    parent = path_map[parent_path]
                    node_type = "tree" if i < len(parts) else item["type"]
                    node = {
                        "name": parts[i - 1],
                        "path": sub_path,
                        "type": node_type,
                        "children": [] if node_type == "tree" else None,
                    }
                    if node_type == "blob":
                        node["sha"] = item.get("sha")
                        node["size"] = item.get("size")

                    parent["children"].append(node)
                    path_map[sub_path] = node

        return root["children"]

    async def get_dir_struct(self) -> list:
        """Fetch and return a nested directory structure for the repo."""
        async with httpx.AsyncClient() as client:
            meta = await client.get(self._repo_url, headers=self._headers)
            meta.raise_for_status()
            default_branch = meta.json()["default_branch"]

            tree_resp = await client.get(
                f"{self._repo_url}/git/trees/{default_branch}",
                headers=self._headers,
                params={"recursive": "1"},
            )
            tree_resp.raise_for_status()

        lis = [
            {
                "type": item["type"],
                "path": item["path"],
                "size": item.get("size"),
                "sha": item["sha"],
            }
            for item in tree_resp.json().get("tree", [])
        ]
        return self.build_tree(lis)
