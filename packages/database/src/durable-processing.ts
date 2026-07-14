import { randomUUID } from "node:crypto";

import {
  parseDurableSyntheticRequestedEvent,
  type ValidatedDurableSyntheticRequestedEvent,
} from "@cumulore/schemas";
import type { PoolClient } from "pg";

export const syntheticOperationScenarios = [
  "database_effect",
  "external_success",
  "unknown_then_success",
  "retryable_failure",
  "non_retryable_failure",
  "cooperative_wait",
] as const;

export type SyntheticOperationScenario =
  (typeof syntheticOperationScenarios)[number];

export type CreateSyntheticOperationInput = {
  workspaceId: string;
  requestedByUserId: string;
  scenario: SyntheticOperationScenario;
  inputVersion: number;
  configurationVersion: number;
  correlationId: string;
  causationId?: string;
};

export type CreatedSyntheticOperation = {
  operationId: string;
  eventId: string;
};

export async function appendOutboxEvent(
  client: PoolClient,
  event: ValidatedDurableSyntheticRequestedEvent,
): Promise<void> {
  await client.query(
    `INSERT INTO outbox_events (
       id,
       scope,
       workspace_id,
       event_type,
       schema_version,
       occurred_at,
       actor_type,
       actor_id,
       correlation_id,
       causation_id,
       payload
     ) VALUES ($1, 'workspace', $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      event.event_id,
      event.workspace_id,
      event.event_type,
      event.schema_version,
      event.occurred_at,
      event.actor.type,
      event.actor.id,
      event.correlation_id,
      event.causation_id,
      event.payload,
    ],
  );
}

export async function createSyntheticOperationAndEvent(
  client: PoolClient,
  input: CreateSyntheticOperationInput,
): Promise<CreatedSyntheticOperation> {
  if (
    !(syntheticOperationScenarios as readonly string[]).includes(input.scenario)
  )
    throw new Error("scenario is unsupported");
  if (!Number.isInteger(input.inputVersion) || input.inputVersion <= 0)
    throw new Error("inputVersion must be a positive integer");
  if (
    !Number.isInteger(input.configurationVersion) ||
    input.configurationVersion <= 0
  )
    throw new Error("configurationVersion must be a positive integer");

  const operation = await client.query<{ id: string }>(
    `INSERT INTO synthetic_operations (
       workspace_id,
       requested_by_user_id,
       scenario,
       input_version,
       configuration_version
     ) VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      input.workspaceId,
      input.requestedByUserId,
      input.scenario,
      input.inputVersion,
      input.configurationVersion,
    ],
  );
  const operationId = operation.rows[0]!.id;
  const eventId = randomUUID();
  const event = parseDurableSyntheticRequestedEvent({
    event_id: eventId,
    event_type: "durable.synthetic.requested",
    schema_version: 1,
    occurred_at: new Date().toISOString(),
    workspace_id: input.workspaceId,
    actor: { type: "user", id: input.requestedByUserId },
    correlation_id: input.correlationId,
    causation_id: input.causationId ?? null,
    payload: { synthetic_operation_id: operationId },
  });
  await appendOutboxEvent(client, event);
  return { operationId, eventId };
}
