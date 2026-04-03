from __future__ import annotations

from apps.crawler.types import ExtractedContent


def _estimate_tokens(text: str) -> int:
    return max(1, int(len(text.split()) * 1.3))


def chunk_by_headings(
    extracted: ExtractedContent,
    *,
    min_tokens: int = 400,
    max_tokens: int = 900,
    overlap_tokens: int = 100,
) -> list[dict[str, str]]:
    """Heading-aware chunking with configurable overlap."""
    if overlap_tokens < 80:
        overlap_tokens = 80
    if overlap_tokens > 150:
        overlap_tokens = 150

    sections = extracted.headings[:] if extracted.headings else [extracted.title or "Document"]
    body_parts = [p.strip() for p in extracted.body.split("\n") if p.strip()]

    chunks: list[dict[str, str]] = []
    current_heading = sections[0] if sections else "Document"
    current_lines: list[str] = []

    for line in body_parts:
        if line in sections:
            current_heading = line

        candidate = "\n".join(current_lines + [line])
        if current_lines and _estimate_tokens(candidate) > max_tokens:
            chunk_text = "\n".join(current_lines)
            chunks.append({"heading": current_heading, "text": chunk_text})
            overlap_text = " ".join(chunk_text.split()[-overlap_tokens:])
            current_lines = [overlap_text, line] if overlap_text else [line]
        else:
            current_lines.append(line)

    if current_lines:
        chunk_text = "\n".join(current_lines)
        chunks.append({"heading": current_heading, "text": chunk_text})

    # Merge tiny chunks to hit practical lower bound.
    merged: list[dict[str, str]] = []
    for chunk in chunks:
        if merged and _estimate_tokens(chunk["text"]) < min_tokens:
            merged[-1]["text"] = f"{merged[-1]['text']}\n{chunk['text']}"
        else:
            merged.append(chunk)
    return merged
