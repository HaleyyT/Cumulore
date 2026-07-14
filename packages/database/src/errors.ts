export type ApplicationErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "conflict"
  | "invalid_state"
  | "validation"
  | "idempotency_conflict"
  | "internal";

const DEFAULT_MESSAGES: Record<ApplicationErrorCode, string> = {
  unauthenticated: "Authentication is required",
  forbidden: "The requested operation is not permitted",
  conflict: "The requested operation conflicts with current state",
  invalid_state: "The resource is not in a valid state for this operation",
  validation: "The request is invalid",
  idempotency_conflict: "The idempotency key conflicts with an earlier request",
  internal: "The operation could not be completed",
};

/** A safe application-boundary error. Details belong in private diagnostics. */
export class ApplicationError extends Error {
  public readonly publicMessage: string;

  public constructor(
    public readonly code: ApplicationErrorCode,
    message = DEFAULT_MESSAGES[code],
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ApplicationError";
    this.publicMessage = DEFAULT_MESSAGES[code];
  }
}
