"""Deterministic, dependency-light extraction for the first ingestion slice."""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from xml.etree import ElementTree
from zipfile import BadZipFile, ZipFile

MAX_BYTES = 50 * 1024 * 1024
SUPPORTED_CONTENT_TYPES = {
    "application/pdf": "pdf",
    "text/plain": "txt",
    "text/plain; charset=utf-8": "txt",
    "text/x-cumulore-pasted": "pasted_text",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
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
    elif format_name == "docx":
        elements = _extract_docx(data)
    elif format_name == "pptx":
        elements = _extract_pptx(data)
    else:
        elements = _extract_text(data)
    if not elements:
        raise IngestionError("empty_extraction")
    return ExtractionResult(
        format=format_name,
        sha256=hashlib.sha256(data).hexdigest(),
        byte_size=len(data),
        parser_version=(
            "cumulore-office-1" if format_name in {"docx", "pptx"} else "cumulore-text-1"
        ),
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


def _open_office_archive(data: bytes) -> ZipFile:
    try:
        archive = ZipFile(BytesIO(data))
    except BadZipFile as error:
        raise IngestionError("invalid_office_archive") from error
    total_uncompressed = 0
    for member in archive.infolist():
        if member.file_size > MAX_BYTES or total_uncompressed + member.file_size > MAX_BYTES:
            archive.close()
            raise IngestionError("archive_size_limit")
        total_uncompressed += member.file_size
    return archive


def _xml_text(element: ElementTree.Element) -> str:
    return " ".join(" ".join(element.itertext()).split())


def _extract_docx(data: bytes) -> list[ExtractedElement]:
    archive = _open_office_archive(data)
    try:
        try:
            root = ElementTree.fromstring(archive.read("word/document.xml"))
        except (KeyError, ElementTree.ParseError) as error:
            raise IngestionError("invalid_docx_document") from error
        elements: list[ExtractedElement] = []
        table_paragraphs = {
            id(paragraph)
            for table in root.iter()
            if table.tag.rsplit("}", 1)[-1] == "tbl"
            for paragraph in table.iter()
            if paragraph.tag.rsplit("}", 1)[-1] == "p"
        }
        paragraph_number = 0
        for node in root.iter():
            if node.tag.rsplit("}", 1)[-1] != "p":
                continue
            if id(node) in table_paragraphs:
                continue
            text = _xml_text(node)
            if not text:
                continue
            style = next(
                (
                    value
                    for child in node.iter()
                    if child.tag.rsplit("}", 1)[-1] == "pStyle"
                    for key, value in child.attrib.items()
                    if key.rsplit("}", 1)[-1] == "val"
                ),
                "",
            )
            kind = "heading" if style.lower().startswith("heading") else "paragraph"
            elements.append(ExtractedElement(kind, text, {"paragraph": paragraph_number}))
            paragraph_number += 1
        table_number = 0
        for table in (node for node in root.iter() if node.tag.rsplit("}", 1)[-1] == "tbl"):
            rows: list[str] = []
            for row in (node for node in table.iter() if node.tag.rsplit("}", 1)[-1] == "tr"):
                cells = [
                    _xml_text(cell)
                    for cell in row.iter()
                    if cell.tag.rsplit("}", 1)[-1] == "tc" and _xml_text(cell)
                ]
                if cells:
                    rows.append(" | ".join(cells))
            if rows:
                elements.append(ExtractedElement("table", "\n".join(rows), {"table": table_number}))
                table_number += 1
        return elements
    finally:
        archive.close()


def _extract_pptx(data: bytes) -> list[ExtractedElement]:
    archive = _open_office_archive(data)
    try:
        slide_names = sorted(
            (
                name
                for name in archive.namelist()
                if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)
            ),
            key=_slide_number,
        )
        if not slide_names:
            raise IngestionError("invalid_pptx_slides")
        elements: list[ExtractedElement] = []
        for slide_name in slide_names:
            try:
                root = ElementTree.fromstring(archive.read(slide_name))
            except ElementTree.ParseError as error:
                raise IngestionError("invalid_pptx_slide") from error
            text = " ".join(
                " ".join(" ".join(node.itertext()).split())
                for node in root.iter()
                if node.tag.rsplit("}", 1)[-1] == "t"
            ).strip()
            if text:
                slide_number = _slide_number(slide_name)
                elements.append(ExtractedElement("page", text, {"slide": slide_number}))
        return elements
    finally:
        archive.close()


def _slide_number(name: str) -> int:
    match = re.fullmatch(r"ppt/slides/slide(\d+)\.xml", name)
    if match is None:
        raise IngestionError("invalid_pptx_slide_name")
    return int(match.group(1))
