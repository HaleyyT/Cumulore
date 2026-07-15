"""Deterministic local embedding adapter for retrieval contract tests only."""

from __future__ import annotations

import hashlib
import math

EMBEDDING_MODEL = "synthetic-hash-8-v1"


def deterministic_embedding(text: str, dimensions: int = 8) -> tuple[float, ...]:
    if not text.strip() or dimensions != 8:
        raise ValueError("synthetic embedding requires text and eight dimensions")
    values = [0.0] * dimensions
    for token in text.lower().split():
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = digest[0] % dimensions
        values[index] += 1.0 if digest[1] & 1 else -1.0
    magnitude = math.sqrt(sum(value * value for value in values))
    if magnitude == 0:
        values[0] = 1.0
        magnitude = 1.0
    return tuple(round(value / magnitude, 8) for value in values)
