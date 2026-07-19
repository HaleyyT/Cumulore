const removedOpenAIKeywords = new Set([
  "$id",
  "$schema",
  "maxLength",
  "minLength",
  "uniqueItems",
]);

const supportedOpenAIKeywords = new Set([
  "$defs",
  "$ref",
  "additionalProperties",
  "anyOf",
  "description",
  "enum",
  "exclusiveMaximum",
  "exclusiveMinimum",
  "format",
  "items",
  "maxItems",
  "maximum",
  "minItems",
  "minimum",
  "multipleOf",
  "pattern",
  "properties",
  "required",
  "type",
]);

type JsonSchema = Record<string, unknown>;

function inferredEnumType(values: unknown[]): string | undefined {
  if (values.length === 0) return undefined;
  if (values.every((value) => typeof value === "string")) return "string";
  if (values.every((value) => typeof value === "boolean")) return "boolean";
  if (values.every((value) => Number.isInteger(value))) return "integer";
  if (values.every((value) => typeof value === "number")) return "number";
  return undefined;
}

function convertSchemaNode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => convertSchemaNode(item));
  if (typeof value !== "object" || value === null) return value;

  const source = value as JsonSchema;
  const converted: JsonSchema = {};

  for (const [key, item] of Object.entries(source)) {
    if (removedOpenAIKeywords.has(key) || key === "const") continue;
    if (key === "properties" || key === "$defs") {
      converted[key] = Object.fromEntries(
        Object.entries(item as JsonSchema).map(([name, child]) => [
          name,
          convertSchemaNode(child),
        ]),
      );
      continue;
    }
    converted[key] = convertSchemaNode(item);
  }

  if ("const" in source) converted.enum = [source.const];
  const enumValues = Array.isArray(converted.enum) ? converted.enum : undefined;
  if (!("type" in converted) && enumValues) {
    const type = inferredEnumType(enumValues);
    if (type) converted.type = type;
  }

  return converted;
}

export function toOpenAIStructuredOutputSchema(value: unknown): JsonSchema {
  const converted = convertSchemaNode(value);
  if (
    typeof converted !== "object" ||
    converted === null ||
    Array.isArray(converted)
  )
    throw new Error("OpenAI Structured Output schema must be an object");

  const issues = findOpenAISchemaCompatibilityIssues(converted);
  if (issues.length > 0)
    throw new Error(
      `OpenAI Structured Output schema is incompatible: ${issues.join(", ")}`,
    );
  return converted as JsonSchema;
}

export function findOpenAISchemaCompatibilityIssues(
  value: unknown,
  path = "$",
): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return [`${path}: schema node must be an object`];

  const schema = value as JsonSchema;
  const issues: string[] = [];
  for (const key of Object.keys(schema)) {
    if (!supportedOpenAIKeywords.has(key))
      issues.push(`${path}.${key}: unsupported keyword`);
  }

  if (path === "$" && schema.type !== "object")
    issues.push("$: root type must be object");

  if (schema.type === "object") {
    const properties = schema.properties;
    const required = schema.required;
    if (
      typeof properties !== "object" ||
      properties === null ||
      Array.isArray(properties)
    ) {
      issues.push(`${path}.properties: object schema must define properties`);
    } else {
      const propertyNames = Object.keys(properties as JsonSchema).sort();
      const requiredNames = Array.isArray(required)
        ? required
            .filter((item): item is string => typeof item === "string")
            .sort()
        : [];
      if (JSON.stringify(propertyNames) !== JSON.stringify(requiredNames))
        issues.push(
          `${path}.required: must contain every property exactly once`,
        );
      for (const [name, child] of Object.entries(properties as JsonSchema))
        issues.push(
          ...findOpenAISchemaCompatibilityIssues(
            child,
            `${path}.properties.${name}`,
          ),
        );
    }
    if (schema.additionalProperties !== false)
      issues.push(`${path}.additionalProperties: must be false`);
  }

  if ("items" in schema)
    issues.push(
      ...findOpenAISchemaCompatibilityIssues(schema.items, `${path}.items`),
    );
  if (Array.isArray(schema.anyOf))
    schema.anyOf.forEach((child, index) =>
      issues.push(
        ...findOpenAISchemaCompatibilityIssues(
          child,
          `${path}.anyOf[${index}]`,
        ),
      ),
    );
  if (
    typeof schema.$defs === "object" &&
    schema.$defs !== null &&
    !Array.isArray(schema.$defs)
  )
    for (const [name, child] of Object.entries(schema.$defs as JsonSchema))
      issues.push(
        ...findOpenAISchemaCompatibilityIssues(child, `${path}.$defs.${name}`),
      );

  return issues;
}
