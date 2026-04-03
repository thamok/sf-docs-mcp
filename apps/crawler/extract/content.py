from __future__ import annotations

from html.parser import HTMLParser
from io import BytesIO

from apps.crawler.types import ExtractedContent


class _SalesforceHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title = ""
        self.headings: list[str] = []
        self.body_chunks: list[str] = []
        self.code_blocks: list[str] = []
        self.tables: list[str] = []
        self.admonitions: list[str] = []
        self._current_tag: str | None = None
        self._buffer: list[str] = []
        self._class_stack: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._current_tag = tag
        class_attr = " ".join([v for k, v in attrs if k == "class" and v])
        self._class_stack.append(class_attr)
        if tag in {"pre", "code", "table", "h1", "h2", "h3", "h4", "h5", "h6", "title", "p", "li", "div"}:
            self._buffer = []

    def handle_endtag(self, tag: str) -> None:
        text = " ".join("".join(self._buffer).split())
        classes = self._class_stack.pop() if self._class_stack else ""
        if text:
            if tag == "title":
                self.title = text
            elif tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
                self.headings.append(text)
                self.body_chunks.append(text)
            elif tag in {"pre", "code"}:
                self.code_blocks.append(text)
                self.body_chunks.append(text)
            elif tag == "table":
                self.tables.append(text)
                self.body_chunks.append(text)
            elif "admonition" in classes or "slds-notify" in classes:
                self.admonitions.append(text)
                self.body_chunks.append(text)
            elif tag in {"p", "li", "div"}:
                self.body_chunks.append(text)
        self._buffer = []
        self._current_tag = None

    def handle_data(self, data: str) -> None:
        if self._current_tag:
            self._buffer.append(data)


def extract_content(content_type: str, payload: bytes) -> ExtractedContent:
    lowered = content_type.lower()
    if "html" in lowered:
        parser = _SalesforceHTMLParser()
        parser.feed(payload.decode("utf-8", errors="replace"))
        return ExtractedContent(
            title=parser.title,
            headings=parser.headings,
            body="\n".join(parser.body_chunks),
            code_blocks=parser.code_blocks,
            tables=parser.tables,
            admonitions=parser.admonitions,
        )

    if "pdf" in lowered:
        text = _extract_pdf_text(payload)
        return ExtractedContent(title="", headings=[], body=text)

    return ExtractedContent(title="", body=payload.decode("utf-8", errors="replace"))


def _extract_pdf_text(payload: bytes) -> str:
    try:
        from pypdf import PdfReader  # type: ignore

        reader = PdfReader(BytesIO(payload))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception:
        return payload.decode("latin-1", errors="replace")
