"""Independently startable durable-processing worker roles."""

from __future__ import annotations

import argparse
import asyncio
import os
import signal
from dataclasses import dataclass
from typing import Any

import psycopg
from psycopg.rows import dict_row


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
    async with await psycopg.AsyncConnection.connect(config.database_url) as connection:
        async with connection.transaction():
            await connection.execute("SET LOCAL ROLE cumulore_worker")
            cursor = await connection.execute("SELECT app.dispatch_outbox(50) AS dispatched")
            row = await cursor.fetchone()
            return int(row[0] if row else 0)


async def executor_once(config: RuntimeConfig) -> int:
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
        return 0
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
    return 1


async def maintenance_once(config: RuntimeConfig) -> int:
    async with await psycopg.AsyncConnection.connect(config.database_url) as connection:
        async with connection.transaction():
            await connection.execute("SET LOCAL ROLE cumulore_worker")
            cursor = await connection.execute(
                "SELECT app.maintenance_tick(%s)", (config.worker_owner,)
            )
            row = await cursor.fetchone()
            return int(row[0] if row else 0)


async def loop(role: str, config: RuntimeConfig, stop: asyncio.Event) -> None:
    action = {
        "dispatcher": dispatcher_once,
        "executor": executor_once,
        "maintenance": maintenance_once,
    }[role]
    while not stop.is_set():
        await action(config)
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
                await actions[item](config)
        else:
            await actions[role](config)
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
