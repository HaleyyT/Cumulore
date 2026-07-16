"""Independently startable, lease-fenced durable-processing worker roles."""

from __future__ import annotations

import argparse
import asyncio
import os
import signal
import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Literal

import psycopg
from psycopg.rows import dict_row

from .observability import emit_operational_log

ClaimedJob = dict[str, Any]
JobOutcome = Literal["succeeded", "failed", "cancelled"]
Handler = Callable[["RuntimeConfig", ClaimedJob], Awaitable[tuple[JobOutcome, str | None]]]


@dataclass(frozen=True)
class RuntimeConfig:
    database_url: str
    worker_owner: str
    poll_seconds: float = 0.5
    lease_seconds: int = 60
    heartbeat_seconds: float = 20.0
    shutdown_grace_seconds: float = 45.0
    synthetic_wait_seconds: float = 65.0

    @classmethod
    def from_environment(cls) -> RuntimeConfig:
        database_url = os.environ.get("DATABASE_URL")
        if not database_url:
            raise RuntimeError("DATABASE_URL is required")
        config = cls(
            database_url,
            os.environ.get("CUMULORE_WORKER_OWNER", "worker-local"),
            float(os.environ.get("CUMULORE_POLL_SECONDS", "0.5")),
            int(os.environ.get("CUMULORE_LEASE_SECONDS", "60")),
            float(os.environ.get("CUMULORE_HEARTBEAT_SECONDS", "20")),
            float(os.environ.get("CUMULORE_SHUTDOWN_GRACE_SECONDS", "45")),
            float(os.environ.get("CUMULORE_SYNTHETIC_WAIT_SECONDS", "65")),
        )
        if (
            not config.worker_owner.strip()
            or len(config.worker_owner) > 120
            or config.poll_seconds <= 0
            or not 1 <= config.lease_seconds <= 300
            or config.heartbeat_seconds <= 0
            or config.heartbeat_seconds >= config.lease_seconds
            or config.shutdown_grace_seconds <= 0
            or config.synthetic_wait_seconds < 0
        ):
            raise RuntimeError("worker timing or owner configuration is invalid")
        return config


async def _worker_connection(config: RuntimeConfig) -> psycopg.AsyncConnection[Any]:
    return await psycopg.AsyncConnection.connect(config.database_url, row_factory=dict_row)


async def ensure_handler_readiness(config: RuntimeConfig) -> None:
    async with await _worker_connection(config) as connection:
        async with connection.transaction():
            await connection.execute("SET LOCAL ROLE cumulore_worker")
            cursor = await connection.execute("SELECT * FROM app.required_handler_versions()")
            required = {
                (str(row["handler_name"]), int(row["handler_version"]))
                for row in await cursor.fetchall()
            }
    missing = required - HANDLER_REGISTRY.keys()
    if missing:
        versions = ", ".join(f"{name}@{version}" for name, version in sorted(missing))
        raise RuntimeError(f"worker artifact is missing required handlers: {versions}")


async def dispatcher_once(config: RuntimeConfig) -> int:
    started = time.perf_counter()
    async with await _worker_connection(config) as connection:
        async with connection.transaction():
            await connection.execute("SET LOCAL ROLE cumulore_worker")
            cursor = await connection.execute("SELECT app.dispatch_outbox(50) AS dispatched")
            row = await cursor.fetchone()
            dispatched = int(row["dispatched"] if row else 0)
    emit_operational_log(
        level="info",
        operation="outbox.dispatch",
        correlation_id=str(uuid.uuid4()),
        outcome="succeeded" if dispatched else "idle",
        duration_ms=(time.perf_counter() - started) * 1000,
        metrics={"dispatched_count": dispatched},
    )
    return dispatched


async def _renew_lease(config: RuntimeConfig, job: ClaimedJob) -> bool:
    async with await _worker_connection(config) as connection:
        async with connection.transaction():
            await connection.execute("SET LOCAL ROLE cumulore_worker")
            await connection.execute(
                "SELECT set_config('app.workspace_id', %s, true)",
                (str(job["workspace_id"]),),
            )
            cursor = await connection.execute(
                "SELECT app.renew_job_lease(%s,%s,%s,%s,%s) AS renewed",
                (
                    job["job_id"],
                    job["attempt_id"],
                    config.worker_owner,
                    job["lease_generation"],
                    config.lease_seconds,
                ),
            )
            row = await cursor.fetchone()
            return bool(row and row["renewed"])


async def _heartbeat(config: RuntimeConfig, job: ClaimedJob, stopped: asyncio.Event) -> None:
    while not stopped.is_set():
        try:
            await asyncio.wait_for(stopped.wait(), timeout=config.heartbeat_seconds)
            return
        except TimeoutError:
            if not await _renew_lease(config, job):
                raise RuntimeError("job lease fence was lost")


async def _fail_job(
    config: RuntimeConfig,
    job: ClaimedJob,
    error_code: str,
    *,
    retryable: bool = False,
) -> None:
    async with await _worker_connection(config) as connection:
        async with connection.transaction():
            await connection.execute("SET LOCAL ROLE cumulore_worker")
            await connection.execute(
                "SELECT set_config('app.workspace_id', %s, true)",
                (str(job["workspace_id"]),),
            )
            await connection.execute(
                "SELECT app.fail_job(%s,%s,%s,%s,%s,%s)",
                (
                    job["job_id"],
                    job["attempt_id"],
                    config.worker_owner,
                    job["lease_generation"],
                    retryable,
                    error_code,
                ),
            )


async def _acknowledge_cancellation(config: RuntimeConfig, job: ClaimedJob) -> bool:
    async with await _worker_connection(config) as connection:
        async with connection.transaction():
            await connection.execute("SET LOCAL ROLE cumulore_worker")
            await connection.execute(
                "SELECT set_config('app.workspace_id', %s, true)",
                (str(job["workspace_id"]),),
            )
            state_cursor = await connection.execute(
                "SELECT cancel_requested_at IS NOT NULL AS requested "
                "FROM jobs WHERE workspace_id = %s AND id = %s",
                (job["workspace_id"], job["job_id"]),
            )
            state = await state_cursor.fetchone()
            if not state or not state["requested"]:
                return False
            result_cursor = await connection.execute(
                "SELECT app.acknowledge_job_cancellation(%s,%s,%s,%s) AS acknowledged",
                (
                    job["job_id"],
                    job["attempt_id"],
                    config.worker_owner,
                    job["lease_generation"],
                ),
            )
            result = await result_cursor.fetchone()
            return bool(result and result["acknowledged"])


async def _run_synthetic(config: RuntimeConfig, job: ClaimedJob) -> tuple[JobOutcome, str | None]:
    async with await _worker_connection(config) as connection:
        async with connection.transaction():
            await connection.execute("SET LOCAL ROLE cumulore_worker")
            await connection.execute(
                "SELECT set_config('app.workspace_id', %s, true)",
                (str(job["workspace_id"]),),
            )
            payload: dict[str, Any] = job["payload"]
            operation_id = payload.get("synthetic_operation_id")
            operation = await connection.execute(
                "SELECT scenario FROM synthetic_operations WHERE id = %s",
                (operation_id,),
            )
            operation_row = await operation.fetchone()
    if not isinstance(operation_id, str) or operation_row is None:
        await _fail_job(config, job, "invalid_operation")
        return "failed", "invalid_operation"
    if await _acknowledge_cancellation(config, job):
        return "cancelled", None
    scenario = str(operation_row["scenario"])
    if scenario == "cooperative_wait":
        await asyncio.sleep(config.synthetic_wait_seconds)
        if await _acknowledge_cancellation(config, job):
            return "cancelled", None
        async with await _worker_connection(config) as connection:
            async with connection.transaction():
                await connection.execute("SET LOCAL ROLE cumulore_worker")
                await connection.execute(
                    "SELECT set_config('app.workspace_id', %s, true)",
                    (str(job["workspace_id"]),),
                )
                cursor = await connection.execute(
                    "SELECT app.complete_job(%s,%s,%s,%s) AS completed",
                    (
                        job["job_id"],
                        job["attempt_id"],
                        config.worker_owner,
                        job["lease_generation"],
                    ),
                )
                row = await cursor.fetchone()
                if not row or not row["completed"]:
                    return "failed", "stale_lease_fence"
        return "succeeded", None
    if scenario != "database_effect":
        await _fail_job(config, job, "provider_runtime_deferred")
        return "failed", "provider_runtime_deferred"
    if await _acknowledge_cancellation(config, job):
        return "cancelled", None
    async with await _worker_connection(config) as connection:
        async with connection.transaction():
            await connection.execute("SET LOCAL ROLE cumulore_worker")
            await connection.execute(
                "SELECT set_config('app.workspace_id', %s, true)",
                (str(job["workspace_id"]),),
            )
            cursor = await connection.execute(
                "SELECT app.complete_job_with_effect("
                "%s,%s,%s,%s,'synthetic.database_effect','database',1,1,"
                "'{}'::jsonb,NULL) AS completed",
                (
                    job["job_id"],
                    job["attempt_id"],
                    config.worker_owner,
                    job["lease_generation"],
                ),
            )
            row = await cursor.fetchone()
            if not row or not row["completed"]:
                return "failed", "stale_lease_fence"
    return "succeeded", None


HANDLER_REGISTRY: dict[tuple[str, int], Handler] = {("run_synthetic", 1): _run_synthetic}


async def executor_once(config: RuntimeConfig) -> int:
    started = time.perf_counter()
    async with await _worker_connection(config) as connection:
        async with connection.transaction():
            await connection.execute("SET LOCAL ROLE cumulore_worker")
            cursor = await connection.execute(
                "SELECT * FROM app.claim_jobs(%s, 1, %s)",
                (config.worker_owner, config.lease_seconds),
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
    key = (str(job["handler_name"]), int(job["handler_version"]))
    handler = HANDLER_REGISTRY.get(key)
    outcome: JobOutcome
    safe_error_code: str | None
    if handler is None:
        await _fail_job(config, job, "unknown_handler_version")
        outcome, safe_error_code = "failed", "unknown_handler_version"
    else:
        heartbeat_stopped = asyncio.Event()
        heartbeat = asyncio.create_task(_heartbeat(config, job, heartbeat_stopped))
        try:
            outcome, safe_error_code = await handler(config, job)
            if heartbeat.done() and heartbeat.exception() is not None:
                raise heartbeat.exception()  # type: ignore[misc]
        finally:
            heartbeat_stopped.set()
            await heartbeat
    emit_operational_log(
        level="info",
        operation="job.execute",
        correlation_id=str(job["correlation_id"]),
        event_id=str(job["event_id"]),
        job_id=str(job["job_id"]),
        handler_version=int(job["handler_version"]),
        outcome=outcome,
        duration_ms=(time.perf_counter() - started) * 1000,
        safe_error_code=safe_error_code,
    )
    return 1


async def maintenance_once(config: RuntimeConfig) -> int:
    started = time.perf_counter()
    async with await _worker_connection(config) as connection:
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
    if role in {"executor", "all"}:
        await ensure_handler_readiness(config)
    if once:
        actions = {
            "dispatcher": dispatcher_once,
            "executor": executor_once,
            "maintenance": maintenance_once,
        }
        selected = ("dispatcher", "executor", "maintenance") if role == "all" else (role,)
        for item in selected:
            await actions[item](config)
        return
    stop = asyncio.Event()
    event_loop = asyncio.get_running_loop()
    for signum in (signal.SIGINT, signal.SIGTERM):
        event_loop.add_signal_handler(signum, stop.set)
    roles = ("dispatcher", "executor", "maintenance") if role == "all" else (role,)
    tasks = [asyncio.create_task(loop(item, config, stop)) for item in roles]
    await stop.wait()
    try:
        await asyncio.wait_for(asyncio.gather(*tasks), timeout=config.shutdown_grace_seconds)
    except TimeoutError:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("role", choices=("dispatcher", "executor", "maintenance", "all"))
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    asyncio.run(run(args.role, args.once))
