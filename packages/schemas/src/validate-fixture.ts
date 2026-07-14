import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import foundationFixture from "../fixtures/contract-fixture.v1.valid.json" with { type: "json" };
import foundationSchema from "../contracts/contract-fixture.v1.schema.json" with { type: "json" };
import invalidActorFixture from "../fixtures/durable.synthetic.requested.v1.invalid-actor.json" with { type: "json" };
import invalidPayloadFixture from "../fixtures/durable.synthetic.requested.v1.invalid-payload.json" with { type: "json" };
import unsupportedVersionFixture from "../fixtures/durable.synthetic.requested.v1.unsupported-version.json" with { type: "json" };
import validEventFixture from "../fixtures/durable.synthetic.requested.v1.valid.json" with { type: "json" };
import { parseDurableSyntheticRequestedEvent } from "./durable-events.js";

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

function expectValid(name: string, schema: object, fixture: unknown): void {
  const validate = ajv.compile(schema);
  if (!validate(fixture))
    throw new Error(`${name} is invalid: ${ajv.errorsText(validate.errors)}`);
}

expectValid("foundation contract fixture", foundationSchema, foundationFixture);
parseDurableSyntheticRequestedEvent(validEventFixture);

for (const [name, fixture] of [
  ["invalid actor fixture", invalidActorFixture],
  ["invalid payload fixture", invalidPayloadFixture],
  ["unsupported version fixture", unsupportedVersionFixture],
] as const) {
  try {
    parseDurableSyntheticRequestedEvent(fixture);
    throw new Error(`${name} unexpectedly passed`);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === `${name} unexpectedly passed`
    )
      throw error;
  }
}

console.log("TypeScript contract fixture validation passed.");
