import assert from "node:assert/strict";

import {
  ApplicationError,
  MAX_UPLOAD_BYTES,
  validateUploadSessionInput,
} from "../src/index.js";

const context = {
  userId: "00000000-0000-4000-8000-000000000001",
  workspaceId: "00000000-0000-4000-8000-000000000002",
};
const now = new Date("2026-07-15T00:00:00.000Z");
const valid = {
  folderId: "00000000-0000-4000-8000-000000000003",
  title: "Course notes.txt",
  format: "txt" as const,
  contentType: "text/plain",
  byteSize: 1024,
  expiresAt: new Date(now.getTime() + 15 * 60_000),
};

assert.doesNotThrow(() => validateUploadSessionInput(context, valid, now));
for (const format of ["docx", "pptx"] as const) {
  assert.doesNotThrow(() =>
    validateUploadSessionInput(
      context,
      {
        ...valid,
        format,
        contentType:
          format === "docx"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      },
      now,
    ),
  );
}
for (const input of [
  { ...valid, title: "   " },
  { ...valid, contentType: "application/pdf" },
  { ...valid, byteSize: 0 },
  { ...valid, byteSize: MAX_UPLOAD_BYTES + 1 },
  { ...valid, expiresAt: now },
  { ...valid, expiresAt: new Date(now.getTime() + 60 * 60_000 + 1) },
]) {
  assert.throws(
    () => validateUploadSessionInput(context, input, now),
    (error) => error instanceof ApplicationError && error.code === "validation",
  );
}

console.log("Ingestion boundary validation tests passed.");
