import assert from "node:assert/strict";

import {
  createOperationalLogRecord,
  emitOperationalLog,
} from "../src/index.js";

const record = createOperationalLogRecord(
  {
    level: "info",
    service: "worker",
    operation: "job.complete",
    correlationId: "00000000-0000-4000-8000-000000000001",
    jobId: "00000000-0000-4000-8000-000000000002",
    handlerVersion: 1,
    durationMs: 12.5,
    outcome: "succeeded",
  },
  new Date("2026-07-15T00:00:00.000Z"),
);
assert.deepEqual(record, {
  timestamp: "2026-07-15T00:00:00.000Z",
  level: "info",
  service: "worker",
  operation: "job.complete",
  correlation_id: "00000000-0000-4000-8000-000000000001",
  outcome: "succeeded",
  job_id: "00000000-0000-4000-8000-000000000002",
  handler_version: 1,
  duration_ms: 12.5,
});

let line = "";
emitOperationalLog(
  {
    level: "warn",
    service: "test",
    operation: "security.denied",
    correlationId: "test-correlation",
    outcome: "failed",
    safeErrorCode: "forbidden",
  },
  (value) => {
    line = value;
  },
);
assert.deepEqual(JSON.parse(line), {
  ...JSON.parse(line),
  operation: "security.denied",
  safe_error_code: "forbidden",
});
assert.doesNotMatch(line, /password|signed_url|source_content/i);
assert.throws(() =>
  createOperationalLogRecord({
    level: "error",
    service: "test",
    operation: "unsafe operation",
    correlationId: "test",
    outcome: "failed",
  }),
);
assert.throws(() =>
  createOperationalLogRecord({
    level: "error",
    service: "test",
    operation: "security.denied",
    correlationId: "private content with spaces",
    outcome: "failed",
  }),
);

console.log("Operational logging contract tests passed.");
