import type { Pool } from "pg";

import { withActorTransaction, type ActorContext } from "./index.js";

export type SourceFormat = "pdf" | "txt" | "pasted_text";

export type UploadSession = {
  sourceId: string;
  sourceVersionId: string;
  uploadSessionId: string;
  quarantineKey: string;
};

export async function createUploadSession(
  pool: Pool,
  context: Required<ActorContext>,
  input: {
    folderId: string;
    title: string;
    format: SourceFormat;
    contentType: string;
    byteSize: number;
    expiresAt: Date;
  },
): Promise<UploadSession> {
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
  input: { uploadSessionId: string; byteSize: number; sha256?: Buffer },
): Promise<string> {
  return withActorTransaction(pool, context, async (client) => {
    const result = await client.query<{ source_id: string }>(
      "SELECT app.finalize_upload($1, $2, $3) AS source_id",
      [input.uploadSessionId, input.byteSize, input.sha256 ?? null],
    );
    return result.rows[0]!.source_id;
  });
}
