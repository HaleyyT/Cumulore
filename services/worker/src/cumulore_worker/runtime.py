"""Independently startable durable-processing worker roles."""

from __future__ import annotations

import argparse
import asyncio
import os
import signal
import time
import uuid
from dataclasses import dataclass
from typing import Any, Literal

import psycopg
from psycopg.rows import dict_row

from .observability import emit_operational_log


@dataclass(frozen=True)
class RuntimeConfig:
    database_url: str
    worker_owner: str
    poll_seconds: float = 0.5

    @classmethod
    def from_environment(cls) -> RuntimeConfig:
        database_url = os.environ.get("DATABASE_URL")
        if not database_url:
            raise RuntimeError("DATABASE_URL is required")
        return cls(
            database_url,
            os.environ.get("CUMULORE_WORKER_OWNER", "worker-local"),
            float(os.environ.get("CUMULORE_POLL_SECONDS", "0.5")),
        )


async def dispatcher_once(config: RuntimeConfig) -> int:
    started = time.perf_counter()
    async with await psycopg.AsyncConnection.connect(config.database_url) as connection:
        async with connection.transaction():
            await connection.execute("SET LOCAL ROLE cumulore_worker")
            cursor = await connection.execute("SELECT app.dispatch_outbox(50) AS dispatched")
            row = await cursor.fetchone()
            dispatched = int(row[0] if row else 0)
    emit_operational_log(
        level="info",
        operation="outbox.dispatch",
        correlation_id=str(uuid.uuid4()),
        outcome="succeeded" if dispatched else "idle",
        duration_ms=(time.perf_counter() - started) * 1000,
        metrics={"dispatched_count": dispatched},
    )
    return dispatched


async def executor_once(config: RuntimeConfig) -> int:
    started = time.perf_counter()
    async with await psycopg.AsyncConnection.connect(
        config.database_url, row_factory=dict_row
    ) as connection:
        async with connection.transaction():
            await connection.execute("SET LOCAL ROLE cumulore_worker")
            cursor = await connection.execute(
                "SELECT * FROM app.claim_jobs(%s, 1, 60)", (config.worker_owner,)
            )
            job = await cursor.fetchone()
    if job is None:
        emit_operational_log(
            level="debug",
            operation="job.execute",
            correlation_id=str(uuid.uuid4()),
            outcome="idle",
            duration_ms=(time.perf_counter() - started) * 1000,
        )
        return 0
    job_outcome: Literal["succeeded", "failed"] = "succeeded"
    safe_error_code: str | None = None
    async with await psycopg.AsyncConnection.connect(
        config.database_url, row_factory=dict_row
    ) as connection:
        async with connection.transaction():
            await connection.execute("SET LOCAL ROLE cumulore_worker")
            await connection.execute(
                "SELECT set_config('app.workspace_id', %s, true)", (str(job["workspace_id"]),)
            )
            payload: dict[str, Any] = job["payload"]
            operation_id = payload.get("synthetic_operation_id")
            operation = await connection.execute(
                "SELECT scenario FROM synthetic_operations WHERE id = %s", (operation_id,)
            )
            operation_row = await operation.fetchone()
            if not isinstance(operation_id, str) or operation_row is None:
                job_outcome = "failed"
                safe_error_code = "invalid_operation"
                await connection.execute(
                    "SELECT app.fail_job(%s,%s,%s,%s,false,'invalid_operation')",
                    (
                        job["job_id"],
                        job["attempt_id"],
                        config.worker_owner,
                        job["lease_generation"],
                    ),
                )
            elif operation_row["scenario"] != "database_effect":
                job_outcome = "failed"
                safe_error_code = "provider_runtime_deferred"
                await connection.execute(
                    "SELECT app.fail_job(%s,%s,%s,%s,false,'provider_runtime_deferred')",
                    (
                        job["job_id"],
                        job["attempt_id"],
                        config.worker_owner,
                        job["lease_generation"],
                    ),
                )
            else:
                await connection.execute(
                    "SELECT app.complete_job_with_effect("
                    "%s,%s,%s,%s,'synthetic.database_effect','database',1,1,"
                    "'{}'::jsonb,NULL)",
                    (
                        job["job_id"],
                        job["attempt_id"],
                        config.worker_owner,
                        job["lease_generation"],
                    ),
                )
    emit_operational_log(
        level="info",
        operation="job.execute",
        correlation_id=str(job["correlation_id"]),
        event_id=str(job["event_id"]),
        job_id=str(job["job_id"]),
        handler_version=int(job["handler_version"]),
        outcome=job_outcome,
        duration_ms=(time.perf_counter() - started) * 1000,
        safe_error_code=safe_error_code,
    )
    return 1


async def maintenance_once(config: RuntimeConfig) -> int:
    started = time.perf_counter()
    async with await psycopg.AsyncConnection.connect(
        config.database_url, row_factory=dict_row
    ) as connection:
        async with connection.transaction():
            await connection.execute("SET LOCAL ROLE cumulore_worker")
            cursor = await connection.execute(
                "SELECT app.maintenance_tick(%s)", (config.worker_owner,)
            )
            row = await cursor.fetchone()
            cleaned = int(row["maintenance_tick"] if row else 0)
            metrics_cursor = await connection.execute("SELECT * FROM app.operational_metrics()")
            metrics_row = await metrics_cursor.fetchone()
    metrics = {
        key: float(value) if isinstance(value, float) else int(value)
        for key, value in (metrics_row or {}).items()
    }
    metrics["cleaned_count"] = cleaned
    emit_operational_log(
        level="info",
        operation="maintenance.tick",
        correlation_id=str(uuid.uuid4()),
        outcome="succeeded",
        duration_ms=(time.perf_counter() - started) * 1000,
        metrics=metrics,
    )
    return cleaned


async def loop(role: str, config: RuntimeConfig, stop: asyncio.Event) -> None:
    action = {
        "dispatcher": dispatcher_once,
        "executor": executor_once,
        "maintenance": maintenance_once,
    }[role]
    while not stop.is_set():
        try:
            await action(config)
        except Exception:
            emit_operational_log(
                level="error",
                operation=f"{role}.loop",
                correlation_id=str(uuid.uuid4()),
                outcome="failed",
                duration_ms=0,
                safe_error_code="worker_operation_failed",
            )
        try:
            await asyncio.wait_for(stop.wait(), timeout=config.poll_seconds)
        except TimeoutError:
            pass


async def run(role: str, once: bool) -> None:
    config = RuntimeConfig.from_environment()
    if once:
        actions = {
            "dispatcher": dispatcher_once,
            "executor": executor_once,
            "maintenance": maintenance_once,
        }
        if role == "all":
            for item in ("dispatcher", "executor", "maintenance"):
                try:
                    await actions[item](config)
                except Exception:
                    emit_operational_log(
                        level="error",
                        operation=f"{item}.once",
                        correlation_id=str(uuid.uuid4()),
                        outcome="failed",
                        duration_ms=0,
                        safe_error_code="worker_operation_failed",
                    )
                    raise
        else:
            try:
                await actions[role](config)
            except Exception:
                emit_operational_log(
                    level="error",
                    operation=f"{role}.once",
                    correlation_id=str(uuid.uuid4()),
                    outcome="failed",
                    duration_ms=0,
                    safe_error_code="worker_operation_failed",
                )
                raise
        return
    stop = asyncio.Event()
    event_loop = asyncio.get_running_loop()
    for signum in (signal.SIGINT, signal.SIGTERM):
        event_loop.add_signal_handler(signum, stop.set)
    roles = ("dispatcher", "executor", "maintenance") if role == "all" else (role,)
    await asyncio.gather(*(loop(item, config, stop) for item in roles))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("role", choices=("dispatcher", "executor", "maintenance", "all"))
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    asyncio.run(run(args.role, args.once))
