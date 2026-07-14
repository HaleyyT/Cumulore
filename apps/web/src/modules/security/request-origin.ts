const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export class RequestSecurityError extends Error {
  public readonly code = "forbidden";
  public readonly publicMessage = "The request origin is not permitted";

  public constructor() {
    super("State-changing request failed the trusted-origin policy");
    this.name = "RequestSecurityError";
  }
}

export type RequestOriginContext = {
  method: string;
  requestUrl: string;
  origin: string | null;
  fetchSite?: string | null;
  allowedOrigins?: readonly string[];
};

/**
 * Enforces the browser origin boundary for future state-changing handlers.
 * Authentication and workspace authorization remain separate mandatory checks.
 */
export function assertTrustedRequestOrigin(
  context: RequestOriginContext,
): void {
  if (SAFE_METHODS.has(context.method.toUpperCase())) return;
  if (context.fetchSite?.toLowerCase() === "cross-site" || !context.origin)
    throw new RequestSecurityError();

  let requestOrigin: string;
  let suppliedOrigin: string;
  try {
    requestOrigin = new URL(context.requestUrl).origin;
    suppliedOrigin = new URL(context.origin).origin;
  } catch {
    throw new RequestSecurityError();
  }
  let allowed: Set<string>;
  try {
    allowed = new Set([
      requestOrigin,
      ...(context.allowedOrigins ?? []).map((origin) => new URL(origin).origin),
    ]);
  } catch {
    throw new RequestSecurityError();
  }
  if (!allowed.has(suppliedOrigin)) throw new RequestSecurityError();
}
