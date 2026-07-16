type JsonObject = Record<string, unknown>;

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new TypeError("non-finite numbers are unsupported");
    return JSON.stringify(value);
  }
  if (Array.isArray(value))
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (typeof value === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype)
      throw new TypeError("only plain JSON objects are supported");
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson((value as JsonObject)[key])}`,
      )
      .join(",")}}`;
  }
  throw new TypeError("unsupported non-JSON value");
}

function cloneJson(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new TypeError("non-finite numbers are unsupported");
    return value;
  }
  if (Array.isArray(value)) return value.map(cloneJson);
  if (typeof value === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype)
      throw new TypeError("only plain JSON objects are supported");
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, cloneJson(child)]),
    );
  }
  throw new TypeError("unsupported non-JSON value");
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value))
    return;
  for (const child of Object.values(value)) deepFreeze(child);
  Object.freeze(value);
}

export function immutableJsonClone<T>(value: T): T {
  const cloned = cloneJson(value) as T;
  deepFreeze(cloned);
  return cloned;
}
