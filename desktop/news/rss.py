"""Generic RSS 2.0 / Atom reader using only the standard library. No CORS proxy is
needed here (unlike the web app) since a desktop process can fetch any URL directly."""
from __future__ import annotations

import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Optional

from .http import get_text


@dataclass
class FeedItem:
    title: str
    link: Optional[str] = None
    pub_date: Optional[str] = None
    description: Optional[str] = None


def _text(el: Optional[ET.Element]) -> Optional[str]:
    if el is None or el.text is None:
        return None
    t = el.text.strip()
    return t or None


def _local(tag: str) -> str:
    return tag.split("}")[-1] if "}" in tag else tag


def parse_feed(xml_text: str) -> list[FeedItem]:
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []

    items: list[FeedItem] = []
    # RSS 2.0: <rss><channel><item>...
    for item_el in root.iter():
        if _local(item_el.tag) != "item":
            continue
        title = None
        link = None
        pub_date = None
        description = None
        for child in item_el:
            tag = _local(child.tag)
            if tag == "title":
                title = _text(child)
            elif tag == "link":
                link = _text(child)
            elif tag in ("pubDate", "date"):
                pub_date = pub_date or _text(child)
            elif tag == "description":
                description = _text(child)
        if title:
            items.append(FeedItem(title=title, link=link, pub_date=pub_date, description=description))

    if items:
        return items

    # Atom: <feed><entry>...
    for entry_el in root.iter():
        if _local(entry_el.tag) != "entry":
            continue
        title = None
        link = None
        pub_date = None
        description = None
        for child in entry_el:
            tag = _local(child.tag)
            if tag == "title":
                title = _text(child)
            elif tag == "link":
                link = child.get("href") or _text(child)
            elif tag in ("updated", "published"):
                pub_date = pub_date or _text(child)
            elif tag in ("summary", "content"):
                description = _text(child)
        if title:
            items.append(FeedItem(title=title, link=link, pub_date=pub_date, description=description))

    return items


def fetch_feed(url: str, timeout: int = 12) -> list[FeedItem]:
    xml_text = get_text(url, timeout=timeout)
    return parse_feed(xml_text)
