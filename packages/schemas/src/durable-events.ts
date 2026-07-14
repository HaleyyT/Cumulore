import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import durableSyntheticRequestedSchema from "../contracts/durable.synthetic.requested.v1.schema.json" with { type: "json" };

export type DurableEventActor =
  | { type: "user"; id: string }
  | { type: "worker"; id: string }
  | { type: "system"; id: null };

export type DurableSyntheticRequestedEvent = {
  event_id: string;
  event_type: "durable.synthetic.requested";
  schema_version: 1;
  occurred_at: string;
  workspace_id: string;
  actor: DurableEventActor;
  correlation_id: string;
  causation_id: string | null;
  payload: { synthetic_operation_id: string };
};

declare const validatedEvent: unique symbol;

export type ValidatedDurableSyntheticRequestedEvent =
  DurableSyntheticRequestedEvent & {
    readonly [validatedEvent]: true;
  };

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateDurableSyntheticRequested = ajv.compile(
  durableSyntheticRequestedSchema,
);

export function parseDurableSyntheticRequestedEvent(
  document: unknown,
): ValidatedDurableSyntheticRequestedEvent {
  if (!validateDurableSyntheticRequested(document)) {
    throw new Error(
      `Unsupported or invalid durable.synthetic.requested event: ${ajv.errorsText(validateDurableSyntheticRequested.errors)}`,
    );
  }
  return document as ValidatedDurableSyntheticRequestedEvent;
}
