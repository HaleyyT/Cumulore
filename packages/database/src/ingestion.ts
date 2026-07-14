import { randomUUID } from "node:crypto";

import type { Pool } from "pg";

import { ApplicationError } from "./errors.js";
import { withActorTransaction, type ActorContext } from "./index.js";

export type SourceFormat = "pdf" | "txt" | "pasted_text";

export type UploadSession = {
  sourceId: string;
  sourceVersionId: string;
  uploadSessionId: string;
  quarantineKey: string;
};

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTENT_TYPES: Record<SourceFormat, readonly string[]> = {
  pdf: ["application/pdf"],
  txt: ["text/plain", "text/plain; charset=utf-8"],
  pasted_text: ["text/x-cumulore-pasted"],
};

export type CreateUploadSessionInput = {
  folderId: string;
  title: string;
  format: SourceFormat;
  contentType: string;
  byteSize: number;
  expiresAt: Date;
};

export function validateUploadSessionInput(
  context: Required<ActorContext>,
  input: CreateUploadSessionInput,
  now = new Date(),
): void {
  if (
    !UUID_PATTERN.test(context.userId) ||
    !UUID_PATTERN.test(context.workspaceId)
  )
    throw new ApplicationError(
      "validation",
      "Actor context contains an invalid identifier",
    );
  if (!UUID_PATTERN.test(input.folderId))
    throw new ApplicationError("validation", "Folder identifier is invalid");
  if (input.title.trim().length === 0 || input.title.length > 240)
    throw new ApplicationError(
      "validation",
      "Title must contain 1 to 240 characters",
    );
  if (!CONTENT_TYPES[input.format]?.includes(input.contentType.toLowerCase()))
    throw new ApplicationError(
      "validation",
      "Content type does not match the source format",
    );
  if (
    !Number.isSafeInteger(input.byteSize) ||
    input.byteSize < 1 ||
    input.byteSize > MAX_UPLOAD_BYTES
  )
    throw new ApplicationError(
      "validation",
      "Upload size is outside the approved limit",
    );
  const expiry = input.expiresAt.getTime();
  if (
    !Number.isFinite(expiry) ||
    expiry <= now.getTime() ||
    expiry > now.getTime() + 60 * 60_000
  )
    throw new ApplicationError(
      "validation",
      "Upload expiry must be within one hour",
    );
}

export async function createUploadSession(
  pool: Pool,
  context: Required<ActorContext>,
  input: CreateUploadSessionInput,
): Promise<UploadSession> {
  validateUploadSessionInput(context, input);
  return withActorTransaction(pool, context, async (client) => {
    const result = await client.query<UploadSession>(
      'SELECT source_id AS "sourceId", source_version_id AS "sourceVersionId", upload_session_id AS "uploadSessionId", quarantine_key AS "quarantineKey" FROM app.create_upload_session($1, $2, $3::source_format, $4, $5, $6)',
      [
        input.folderId,
        input.title,
        input.format,
        input.contentType,
        input.byteSize,
        input.expiresAt,
      ],
    );
    return result.rows[0]!;
  });
}

export async function finalizeUpload(
  pool: Pool,
  context: Required<ActorContext>,
  input: {
    uploadSessionId: string;
    byteSize: number;
    sha256?: Buffer;
    correlationId?: string;
    causationId?: string;
  },
): Promise<string> {
  if (
    !UUID_PATTERN.test(context.userId) ||
    !UUID_PATTERN.test(context.workspaceId)
  )
    throw new ApplicationError(
      "validation",
      "Actor context contains an invalid identifier",
    );
  if (!UUID_PATTERN.test(input.uploadSessionId))
    throw new ApplicationError(
      "validation",
      "Upload session identifier is invalid",
    );
  if (
    !Number.isSafeInteger(input.byteSize) ||
    input.byteSize < 1 ||
    input.byteSize > MAX_UPLOAD_BYTES
  )
    throw new ApplicationError(
      "validation",
      "Uploaded size is outside the approved limit",
    );
  if (input.sha256 && input.sha256.byteLength !== 32)
    throw new ApplicationError(
      "validation",
      "SHA-256 digest must contain 32 bytes",
    );
  if (input.correlationId && !UUID_PATTERN.test(input.correlationId))
    throw new ApplicationError(
      "validation",
      "Correlation identifier is invalid",
    );
  if (input.causationId && !UUID_PATTERN.test(input.causationId))
    throw new ApplicationError("validation", "Causation identifier is invalid");
  return withActorTransaction(pool, context, async (client) => {
    const result = await client.query<{ source_id: string }>(
      "SELECT app.finalize_upload($1, $2, $3, $4, $5) AS source_id",
      [
        input.uploadSessionId,
        input.byteSize,
        input.sha256 ?? null,
        input.correlationId ?? randomUUID(),
        input.causationId ?? null,
      ],
    );
    return result.rows[0]!.source_id;
  });
}
