from cumulore_worker.chunking import build_chunks
from cumulore_worker.ingestion import ExtractedElement


def locator(kind: str, index: int, format_name: str = "txt") -> dict[str, object]:
    return {
        "locator_version": 1,
        "format": format_name,
        "segments": [{"kind": kind, "index": index}],
    }


def test_chunking_preserves_heading_context_and_locators() -> None:
    chunks = build_chunks(
        (
            ExtractedElement("heading", "Definitions", locator("line", 1)),
            ExtractedElement("paragraph", "A definition.", locator("line", 2)),
            ExtractedElement("paragraph", "Another definition.", locator("line", 3)),
        ),
        max_chars=100,
    )

    assert len(chunks) == 1
    assert chunks[0].heading_path == ("Definitions",)
    assert chunks[0].locator == {
        "locator_version": 1,
        "format": "txt",
        "segments": [
            {"kind": "line", "index": 2},
            {"kind": "line", "index": 3},
        ],
    }
    assert "Another definition." in chunks[0].text


def test_long_elements_are_split_without_empty_chunks() -> None:
    chunks = build_chunks(
        (ExtractedElement("page", "x" * 205, locator("page", 1, "pdf")),),
        max_chars=100,
    )

    assert [len(chunk.text) for chunk in chunks] == [100, 100, 5]
    assert [chunk.locator["segments"] for chunk in chunks] == [
        [{"kind": "page", "index": 1, "start_offset": 0, "end_offset": 100}],
        [{"kind": "page", "index": 1, "start_offset": 100, "end_offset": 200}],
        [{"kind": "page", "index": 1, "start_offset": 200, "end_offset": 205}],
    ]
