from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

import pytest
from cumulore_worker.ingestion import IngestionError, extract_bytes, extract_file


def _pdf(pages: list[list[str]]) -> bytes:
    page_ids = [3 + index * 2 for index in range(len(pages))]
    content_ids = [page_id + 1 for page_id in page_ids]
    font_id = 3 + len(pages) * 2
    objects: dict[int, bytes] = {
        1: b"<< /Type /Catalog /Pages 2 0 R >>",
        2: (
            f"<< /Type /Pages /Kids [{' '.join(f'{page_id} 0 R' for page_id in page_ids)}] "
            f"/Count {len(page_ids)} >>"
        ).encode(),
        font_id: b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    }
    for page_id, content_id, lines in zip(page_ids, content_ids, pages, strict=True):
        commands = ["BT /F1 12 Tf 72 720 Td"]
        for index, line in enumerate(lines):
            escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            if index:
                commands.append("0 -18 Td")
            commands.append(f"({escaped}) Tj")
        commands.append("ET")
        stream = "\n".join(commands).encode()
        objects[page_id] = (
            f"<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 {font_id} 0 R >> >> "
            f"/MediaBox [0 0 612 792] /Contents {content_id} 0 R >>"
        ).encode()
        objects[content_id] = (
            f"<< /Length {len(stream)} >>\nstream\n".encode()
            + stream
            + b"\nendstream"
        )
    result = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for object_id in range(1, font_id + 1):
        offsets.append(len(result))
        result.extend(f"{object_id} 0 obj\n".encode())
        result.extend(objects[object_id])
        result.extend(b"\nendobj\n")
    xref = len(result)
    result.extend(f"xref\n0 {font_id + 1}\n".encode())
    result.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        result.extend(f"{offset:010d} 00000 n \n".encode())
    result.extend(
        f"trailer\n<< /Size {font_id + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    )
    return bytes(result)


def test_text_extraction_is_normalized_and_located() -> None:
    result = extract_bytes(b"# Week one\n\nDefinitions  are  stable.\n", "text/plain")

    assert result.format == "txt"
    assert [element.kind for element in result.elements] == ["heading", "paragraph"]
    assert result.elements[0].text == "Week one"
    assert result.elements[1].locator == {
        "locator_version": 1,
        "format": "txt",
        "segments": [{"kind": "line", "index": 3}],
    }
    assert len(result.sha256) == 64


def test_simple_pdf_text_is_extracted_with_page_locator() -> None:
    pdf = _pdf([["Hello PDF", "Same page"], ["Second page"]])

    result = extract_bytes(pdf, "application/pdf")

    assert result.format == "pdf"
    assert result.elements[0].text == "Hello PDF Same page"
    assert result.elements[0].locator == {
        "locator_version": 1,
        "format": "pdf",
        "segments": [{"kind": "page", "index": 1}],
    }
    assert result.elements[1].text == "Second page"
    assert result.elements[1].locator["segments"] == [{"kind": "page", "index": 2}]
    assert result.parser_version.startswith("pypdf-")


def test_unsupported_or_empty_content_fails_without_leaking_content() -> None:
    with pytest.raises(IngestionError, match="unsupported_content_type"):
        extract_bytes(b"secret", "application/octet-stream")
    with pytest.raises(IngestionError, match="empty_extraction"):
        extract_bytes(b"\n", "text/plain")


def test_extract_file_uses_bytes_hash(tmp_path: Path) -> None:
    path = tmp_path / "notes.txt"
    path.write_text("one line\n", encoding="utf-8")

    result = extract_file(path, "text/plain; charset=utf-8")

    assert result.byte_size == path.stat().st_size
    assert result.elements[0].text == "one line"


def _office_archive(files: dict[str, bytes]) -> bytes:
    output = BytesIO()
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        for name, value in files.items():
            archive.writestr(name, value)
    return output.getvalue()


def test_docx_extraction_preserves_heading_and_paragraph_locators() -> None:
    docx = _office_archive(
        {
            "word/document.xml": b"""<w:document xmlns:w="urn:w"><w:body>
          <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Title</w:t></w:r></w:p>
          <w:p><w:r><w:t>Body text</w:t></w:r></w:p>
        </w:body></w:document>""",
        }
    )

    result = extract_bytes(
        docx,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )

    assert result.format == "docx"
    assert [element.kind for element in result.elements] == ["heading", "paragraph"]
    assert result.elements[0].locator["segments"] == [
        {"kind": "paragraph", "index": 0}
    ]


def test_pptx_extraction_preserves_slide_locator() -> None:
    pptx = _office_archive(
        {
            "ppt/slides/slide2.xml": (
                b"""<p:sld xmlns:a="urn:a" xmlns:p="urn:p"><p:cSld>"""
                b"""<a:t>Second</a:t></p:cSld></p:sld>"""
            ),
            "ppt/slides/slide1.xml": (
                b"""<p:sld xmlns:a="urn:a" xmlns:p="urn:p"><p:cSld>"""
                b"""<a:t>First</a:t></p:cSld></p:sld>"""
            ),
        }
    )

    result = extract_bytes(
        pptx,
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    )

    assert result.format == "pptx"
    assert [element.text for element in result.elements] == ["First", "Second"]
    assert result.elements[1].locator["segments"] == [{"kind": "slide", "index": 2}]
