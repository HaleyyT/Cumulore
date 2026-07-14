"""Deterministic, dependency-light extraction for the first ingestion slice."""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path

MAX_BYTES = 50 * 1024 * 1024
SUPPORTED_CONTENT_TYPES = {
    "application/pdf": "pdf",
    "text/plain": "txt",
    "text/plain; charset=utf-8": "txt",
    "text/x-cumulore-pasted": "pasted_text",
}


@dataclass(frozen=True)
class ExtractedElement:
    kind: str
    text: str
    locator: dict[str, int | str]


@dataclass(frozen=True)
class ExtractionResult:
    format: str
    sha256: str
    byte_size: int
    parser_version: str
    quality_report: dict[str, int | str]
    elements: tuple[ExtractedElement, ...]


class IngestionError(ValueError):
    """Safe, user-actionable ingestion failure without source content."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def extract_file(path: Path, content_type: str) -> ExtractionResult:
    data = path.read_bytes()
    return extract_bytes(data, content_type)


def extract_bytes(data: bytes, content_type: str) -> ExtractionResult:
    if not data or len(data) > MAX_BYTES:
        raise IngestionError("invalid_size")
    format_name = SUPPORTED_CONTENT_TYPES.get(content_type.lower())
    if format_name is None:
        raise IngestionError("unsupported_content_type")
    if format_name == "pdf":
        elements = _extract_pdf(data)
    else:
        elements = _extract_text(data)
    if not elements:
        raise IngestionError("empty_extraction")
    return ExtractionResult(
        format=format_name,
        sha256=hashlib.sha256(data).hexdigest(),
        byte_size=len(data),
        parser_version="cumulore-text-1",
        quality_report={"element_count": len(elements), "empty_elements": 0},
        elements=tuple(elements),
    )


def _extract_text(data: bytes) -> list[ExtractedElement]:
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise IngestionError("invalid_utf8") from error
    elements: list[ExtractedElement] = []
    for line_number, line in enumerate(text.splitlines(), start=1):
        cleaned = " ".join(line.split())
        if not cleaned:
            continue
        kind = "heading" if cleaned.startswith("#") else "paragraph"
        value = cleaned.lstrip("#").strip() if kind == "heading" else cleaned
        if value:
            elements.append(ExtractedElement(kind, value, {"line": line_number}))
    return elements


def _extract_pdf(data: bytes) -> list[ExtractedElement]:
    if not data.startswith(b"%PDF-"):
        raise IngestionError("invalid_pdf")
    # This intentionally handles the uncompressed PDF text operators emitted by
    # deterministic fixtures and simple exports. Compressed or encrypted PDFs
    # fail visibly until an isolated parser is selected for the deployment.
    raw_strings = re.findall(rb"\((?:\\.|[^()\\])*\)\s*T[Jj]", data)
    elements: list[ExtractedElement] = []
    for page, raw in enumerate(raw_strings, start=1):
        value = raw[1 : raw.rfind(b")")]
        value = re.sub(rb"\\([()\\])", lambda match: match.group(1), value)
        value = value.replace(rb"\\n", b" ").replace(rb"\\r", b" ")
        try:
            text = value.decode("latin-1").strip()
        except UnicodeDecodeError as error:
            raise IngestionError("invalid_pdf_text") from error
        if text:
            elements.append(ExtractedElement("page", text, {"page": page}))
    return elements
