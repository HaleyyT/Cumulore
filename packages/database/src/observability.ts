export type OperationalLogLevel = "debug" | "info" | "warn" | "error";
export type OperationalOutcome = "succeeded" | "failed" | "cancelled" | "idle";

export type OperationalLog = {
  level: OperationalLogLevel;
  service: "web" | "worker" | "migration" | "test";
  operation: string;
  correlationId: string;
  outcome: OperationalOutcome;
  eventId?: string;
  jobId?: string;
  handlerVersion?: number;
  durationMs?: number;
  safeErrorCode?: string;
};

export type OperationalLogRecord = {
  timestamp: string;
  level: OperationalLogLevel;
  service: OperationalLog["service"];
  operation: string;
  correlation_id: string;
  outcome: OperationalOutcome;
  event_id?: string;
  job_id?: string;
  handler_version?: number;
  duration_ms?: number;
  safe_error_code?: string;
};

const SAFE_TOKEN = /^[a-z0-9_.-]{1,120}$/;
const SAFE_IDENTIFIER = /^[A-Za-z0-9_.:-]{1,160}$/;

export function createOperationalLogRecord(
  log: OperationalLog,
  now = new Date(),
): OperationalLogRecord {
  if (!SAFE_TOKEN.test(log.operation))
    throw new TypeError("operation must be a bounded safe token");
  if (log.safeErrorCode && !SAFE_TOKEN.test(log.safeErrorCode))
    throw new TypeError("safe error code must be a bounded safe token");
  for (const [name, value] of [
    ["correlation ID", log.correlationId],
    ["event ID", log.eventId],
    ["job ID", log.jobId],
  ] as const) {
    if (value !== undefined && !SAFE_IDENTIFIER.test(value))
      throw new TypeError(`${name} must be a bounded safe identifier`);
  }
  if (
    log.durationMs !== undefined &&
    (!Number.isFinite(log.durationMs) || log.durationMs < 0)
  )
    throw new TypeError("duration must be a finite non-negative number");
  return {
    timestamp: now.toISOString(),
    level: log.level,
    service: log.service,
    operation: log.operation,
    correlation_id: log.correlationId,
    outcome: log.outcome,
    ...(log.eventId ? { event_id: log.eventId } : {}),
    ...(log.jobId ? { job_id: log.jobId } : {}),
    ...(log.handlerVersion !== undefined
      ? { handler_version: log.handlerVersion }
      : {}),
    ...(log.durationMs !== undefined ? { duration_ms: log.durationMs } : {}),
    ...(log.safeErrorCode ? { safe_error_code: log.safeErrorCode } : {}),
  };
}

export function emitOperationalLog(
  log: OperationalLog,
  sink: (line: string) => void = console.log,
): void {
  sink(JSON.stringify(createOperationalLogRecord(log)));
}
