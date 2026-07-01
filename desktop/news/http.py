"""Tiny stdlib HTTP helper — no third-party dependencies. Unlike a browser, a
desktop process has no CORS restrictions, so every source here is fetched
directly (no proxy needed, unlike the web app's rss.py-equivalent)."""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any, Optional

USER_AGENT = "NewsIntelligenceEngine/1.0 (desktop; contact: support@example.com)"
DEFAULT_TIMEOUT = 12


def get_text(url: str, headers: Optional[dict[str, str]] = None, timeout: int = DEFAULT_TIMEOUT) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # nosec B310 - fixed https URLs from source modules
        charset = resp.headers.get_content_charset() or "utf-8"
        return resp.read().decode(charset, errors="replace")


def get_json(url: str, headers: Optional[dict[str, str]] = None, timeout: int = DEFAULT_TIMEOUT) -> Any:
    text = get_text(url, headers={"Accept": "application/json", **(headers or {})}, timeout=timeout)
    return json.loads(text)


class SourceUnavailable(Exception):
    """Raised when a source fetch fails — callers turn this into SourceResult(ok=False)."""
