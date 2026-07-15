from cumulore_worker.embeddings import deterministic_embedding


def test_synthetic_embedding_is_stable_and_normalized() -> None:
    first = deterministic_embedding("retrieval evidence")
    second = deterministic_embedding("retrieval evidence")

    assert first == second
    assert len(first) == 8
    assert round(sum(value * value for value in first), 5) == 1.0
