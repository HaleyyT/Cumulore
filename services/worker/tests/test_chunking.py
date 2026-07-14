from cumulore_worker.chunking import build_chunks
from cumulore_worker.ingestion import ExtractedElement


def test_chunking_preserves_heading_context_and_locators() -> None:
    chunks = build_chunks(
        (
            ExtractedElement("heading", "Definitions", {"line": 1}),
            ExtractedElement("paragraph", "A definition.", {"line": 2}),
            ExtractedElement("paragraph", "Another definition.", {"line": 3}),
        ),
        max_chars=100,
    )

    assert len(chunks) == 1
    assert chunks[0].heading_path == ("Definitions",)
    assert chunks[0].locator == {"line": 2}
    assert "Another definition." in chunks[0].text


def test_long_elements_are_split_without_empty_chunks() -> None:
    chunks = build_chunks((ExtractedElement("page", "x" * 205, {"page": 1}),), max_chars=100)

    assert [len(chunk.text) for chunk in chunks] == [100, 100, 5]
