from pathlib import Path

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
