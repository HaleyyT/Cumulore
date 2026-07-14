import json

import pytest
from cumulore_worker.observability import emit_operational_log


def test_operational_log_is_structured_and_bounded(
    capsys: pytest.CaptureFixture[str],
) -> None:
    emit_operational_log(
        level="info",
        operation="queue.metrics",
        correlation_id="correlation-1",
        outcome="succeeded",
        duration_ms=12.34567,
        metrics={"queue_depth": 3, "oldest_queue_age_seconds": 1.5},
    )

    record = json.loads(capsys.readouterr().out)
    assert record["service"] == "worker"
    assert record["operation"] == "queue.metrics"
    assert record["duration_ms"] == 12.346
    assert record["metrics"] == {
        "oldest_queue_age_seconds": 1.5,
        "queue_depth": 3,
    }
    assert "workspace_id" not in record
    assert "source_content" not in record


def test_operational_log_rejects_unbounded_tokens() -> None:
    with pytest.raises(ValueError, match="bounded and safe"):
        emit_operational_log(
            level="error",
            operation="unsafe operation",
            correlation_id="correlation-1",
            outcome="failed",
            duration_ms=0,
        )
    with pytest.raises(ValueError, match="identifiers must be bounded and safe"):
        emit_operational_log(
            level="error",
            operation="worker.failed",
            correlation_id="private content with spaces",
            outcome="failed",
            duration_ms=0,
        )
