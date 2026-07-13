import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import fixture from "../fixtures/contract-fixture.v1.valid.json" with { type: "json" };
import schema from "../contracts/contract-fixture.v1.schema.json" with { type: "json" };

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
if (!validate(fixture))
  throw new Error(
    `Contract fixture is invalid: ${ajv.errorsText(validate.errors)}`,
  );
console.log("TypeScript contract fixture validation passed.");
