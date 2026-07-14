"""Small vendor-neutral structured logging boundary with an explicit safe schema."""

from __future__ import annotations

import json
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Literal

LogLevel = Literal["debug", "info", "warn", "error"]
LogOutcome = Literal["succeeded", "failed", "cancelled", "idle"]


def emit_operational_log(
    *,
    level: LogLevel,
    operation: str,
    correlation_id: str,
    outcome: LogOutcome,
    duration_ms: float,
    event_id: str | None = None,
    job_id: str | None = None,
    handler_version: int | None = None,
    safe_error_code: str | None = None,
    metrics: Mapping[str, int | float] | None = None,
) -> None:
    record: dict[str, object] = {
        "timestamp": datetime.now(UTC).isoformat(),
        "level": level,
        "service": "worker",
        "operation": _safe_token(operation),
        "correlation_id": _safe_identifier(correlation_id),
        "outcome": outcome,
        "duration_ms": max(0.0, round(duration_ms, 3)),
    }
    if event_id is not None:
        record["event_id"] = _safe_identifier(event_id)
    if job_id is not None:
        record["job_id"] = _safe_identifier(job_id)
    if handler_version is not None:
        record["handler_version"] = handler_version
    if safe_error_code is not None:
        record["safe_error_code"] = _safe_token(safe_error_code)
    if metrics is not None:
        record["metrics"] = {
            _safe_token(key): value for key, value in sorted(metrics.items())
        }
    print(json.dumps(record, separators=(",", ":"), sort_keys=True), flush=True)


def _safe_token(value: str) -> str:
    if not value or len(value) > 120 or any(
        character not in "abcdefghijklmnopqrstuvwxyz0123456789_.-" for character in value
    ):
        raise ValueError("operational log tokens must be bounded and safe")
    return value


def _safe_identifier(value: str) -> str:
    if not value or len(value) > 160 or any(
        not (character.isascii() and (character.isalnum() or character in "_.:-"))
        for character in value
    ):
        raise ValueError("operational log identifiers must be bounded and safe")
    return value
