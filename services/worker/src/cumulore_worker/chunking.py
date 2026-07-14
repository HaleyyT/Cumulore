"""Deterministic structure-aware chunk construction before semantic indexing."""

from __future__ import annotations

from dataclasses import dataclass

from .ingestion import ExtractedElement


@dataclass(frozen=True)
class SourceChunk:
    kind: str
    text: str
    locator: dict[str, int | str]
    heading_path: tuple[str, ...]


def build_chunks(
    elements: tuple[ExtractedElement, ...], max_chars: int = 1600
) -> tuple[SourceChunk, ...]:
    if max_chars < 100:
        raise ValueError("max_chars must be at least 100")
    chunks: list[SourceChunk] = []
    headings: list[str] = []
    pending: list[str] = []
    pending_kind = "paragraph"
    pending_locator: dict[str, int | str] = {}

    def flush() -> None:
        if pending:
            chunks.append(
                SourceChunk(pending_kind, " ".join(pending), pending_locator, tuple(headings))
            )
            pending.clear()

    for element in elements:
        if element.kind == "heading":
            flush()
            headings[:] = [element.text]
            continue
        if len(element.text) > max_chars:
            flush()
            for start in range(0, len(element.text), max_chars):
                chunks.append(
                    SourceChunk(
                        element.kind,
                        element.text[start : start + max_chars],
                        element.locator,
                        tuple(headings),
                    )
                )
            continue
        candidate = " ".join((*pending, element.text))
        if pending and len(candidate) > max_chars:
            flush()
        if not pending:
            pending_kind = element.kind
            pending_locator = element.locator
        pending.append(element.text)
    flush()
    return tuple(chunks)
