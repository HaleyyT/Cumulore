from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

import pytest
from cumulore_worker.ingestion import IngestionError, extract_bytes, extract_file


def test_text_extraction_is_normalized_and_located() -> None:
    result = extract_bytes(b"# Week one\n\nDefinitions  are  stable.\n", "text/plain")

    assert result.format == "txt"
    assert [element.kind for element in result.elements] == ["heading", "paragraph"]
    assert result.elements[0].text == "Week one"
    assert result.elements[1].locator == {"line": 3}
    assert len(result.sha256) == 64


def test_simple_pdf_text_is_extracted_with_page_locator() -> None:
    pdf = b"%PDF-1.4\n1 0 obj<<>>stream\nBT (Hello PDF) Tj ET\nendstream\nendobj\n%%EOF"

    result = extract_bytes(pdf, "application/pdf")

    assert result.format == "pdf"
    assert result.elements[0].text == "Hello PDF"
    assert result.elements[0].locator == {"page": 1}


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
    assert result.elements[0].locator == {"paragraph": 0}


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
    assert result.elements[1].locator == {"slide": 2}
