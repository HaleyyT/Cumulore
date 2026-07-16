"""Deterministic structure-aware chunk construction before semantic indexing."""

from __future__ import annotations

from dataclasses import dataclass
from typing import cast

from .ingestion import ExtractedElement


@dataclass(frozen=True)
class SourceChunk:
    kind: str
    text: str
    locator: dict[str, object]
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
    pending_format = ""
    pending_segments: list[dict[str, int | str]] = []

    def locator_parts(element: ExtractedElement) -> tuple[str, list[dict[str, int | str]]]:
        format_value = element.locator.get("format")
        segments_value = element.locator.get("segments")
        if (
            element.locator.get("locator_version") != 1
            or not isinstance(format_value, str)
            or not isinstance(segments_value, list)
        ):
            raise ValueError("extraction element requires a version 1 locator")
        segments = cast(list[dict[str, int | str]], segments_value)
        if not all(isinstance(segment, dict) for segment in segments):
            raise ValueError("locator segments must be objects")
        return format_value, [dict(segment) for segment in segments]

    def chunk_locator() -> dict[str, object]:
        return {
            "locator_version": 1,
            "format": pending_format,
            "segments": [dict(segment) for segment in pending_segments],
        }

    def flush() -> None:
        if pending:
            chunks.append(
                SourceChunk(pending_kind, " ".join(pending), chunk_locator(), tuple(headings))
            )
            pending.clear()
            pending_segments.clear()

    for element in elements:
        if element.kind == "heading":
            flush()
            headings[:] = [element.text]
            continue
        element_format, element_segments = locator_parts(element)
        if len(element.text) > max_chars:
            flush()
            for start in range(0, len(element.text), max_chars):
                end = min(start + max_chars, len(element.text))
                split_segments = [
                    {**segment, "start_offset": start, "end_offset": end}
                    for segment in element_segments
                ]
                chunks.append(
                    SourceChunk(
                        element.kind,
                        element.text[start:end],
                        {
                            "locator_version": 1,
                            "format": element_format,
                            "segments": split_segments,
                        },
                        tuple(headings),
                    )
                )
            continue
        candidate = " ".join((*pending, element.text))
        if pending and (
            len(candidate) > max_chars
            or pending_kind != element.kind
            or pending_format != element_format
            or len(pending_segments) + len(element_segments) > 32
        ):
            flush()
        if not pending:
            pending_kind = element.kind
            pending_format = element_format
        pending_segments.extend(element_segments)
        pending.append(element.text)
    flush()
    return tuple(chunks)
