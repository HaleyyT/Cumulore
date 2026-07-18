import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import questGenerationSchema from "../contracts/quest-generation.v1.schema.json" with { type: "json" };

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateQuest = ajv.compile(questGenerationSchema);

export function parseQuestGenerationV1(value: unknown): object {
  if (validateQuest(value)) return value as object;
  throw new Error(
    `Quest generation v1 is invalid: ${ajv.errorsText(validateQuest.errors)}`,
  );
}
