import httpx
from loguru import logger

from src.config.settings import settings
from src.models.schema import GitRequest
from src.service.constants import ALWAYS_SKIP, SKIP_DIRS, SKIP_EXTENSIONS


class RepoTooLargeError(Exception):
    """Raised when a repo exceeds the configured file/size limits."""


def _is_skipped(path: str) -> bool:
    filename = path.split("/")[-1]
    if filename in ALWAYS_SKIP:
        return True
    if any(path.startswith(d) or f"/{d}" in path for d in SKIP_DIRS):
        return True
    if any(filename.endswith(ext) for ext in SKIP_EXTENSIONS):
        return True
    return False


def _is_processable(path: str, req: GitRequest) -> bool:
    if _is_skipped(path):
        return False
    if req.file_extension_include and not any(
        path.endswith(ext) for ext in req.file_extension_include
    ):
        return False
    if req.file_extension_exclude and any(
        path.endswith(ext) for ext in req.file_extension_exclude
    ):
        return False
    if req.dir_exclude and any(
        path.startswith(d) or f"/{d}" in path for d in req.dir_exclude
    ):
        return False
    if req.dir_include and not any(
        path.startswith(d) or f"/{d}" in path for d in req.dir_include
    ):
        return False
    return True


async def _fetch_tree(owner: str, repo: str, ref: str, token: str | None) -> list:
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{ref}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, headers=headers, params={"recursive": "1"})
    if resp.status_code == 404:
        raise RepoTooLargeError(
            f"Repository {owner}/{repo} ref {ref!r} not found or not accessible."
        )
    resp.raise_for_status()
    body = resp.json()
    if body.get("truncated"):
        logger.warning(
            f"GitHub tree truncated for {owner}/{repo} — limits may be inaccurate."
        )
    return body.get("tree", [])


async def enforce_repo_limits(req: GitRequest, ref: str) -> None:
    """Check a repo's file count and total size against configured limits.

    Uses the GitHub Git Trees API to enumerate the repo without cloning it.
    Raises RepoTooLargeError with a detailed message if any limit is exceeded.
    """
    token = req.token or settings.github_token
    tree = await _fetch_tree(req.owner, req.repo, ref, token)

    raw_count = 0
    raw_size = 0
    processable_count = 0
    processable_size = 0

    for entry in tree:
        if entry.get("type") != "blob":
            continue
        path = entry.get("path", "")
        size = entry.get("size", 0) or 0
        raw_count += 1
        raw_size += size
        if _is_processable(path, req):
            processable_count += 1
            processable_size += size

    raw_size_mb = raw_size / (1024 * 1024)
    proc_size_mb = processable_size / (1024 * 1024)

    if raw_count > settings.max_files_raw:
        raise RepoTooLargeError(
            f"Repository has {raw_count} files (raw), over the {settings.max_files_raw} limit."
        )
    if raw_size_mb > settings.max_size_raw_mb:
        raise RepoTooLargeError(
            f"Repository size {raw_size_mb:.1f} MB (raw), over the {settings.max_size_raw_mb} MB limit."
        )
    if processable_count > settings.max_files_processable:
        raise RepoTooLargeError(
            f"Repository has {processable_count} processable files (of {raw_count} total), "
            f"over the {settings.max_files_processable} limit."
        )
    if proc_size_mb > settings.max_size_processable_mb:
        raise RepoTooLargeError(
            f"Repository processable content {proc_size_mb:.1f} MB, "
            f"over the {settings.max_size_processable_mb} MB limit."
        )
