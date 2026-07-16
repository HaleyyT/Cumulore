import { Auth0Client } from "@auth0/nextjs-auth0/server";

type Environment = Record<string, string | undefined>;

export class Auth0ConfigurationError extends Error {
  readonly code = "AUTH0_CONFIGURATION_INVALID" as const;
  readonly missing: readonly string[];

  constructor(missing: readonly string[]) {
    super("Auth0 configuration is incomplete");
    this.name = "Auth0ConfigurationError";
    this.missing = [...missing];
  }
}

export type Auth0Configuration = {
  readonly domain: string;
  readonly clientId: string;
  readonly clientSecret?: string;
  readonly clientAssertionSigningKey?: string;
  readonly appBaseUrl: string;
  readonly secret: string;
  readonly issuerBaseUrl: string;
};

function requiredValue(
  environment: Environment,
  name: string,
  missing: string[],
): string | undefined {
  const value = environment[name]?.trim();
  if (!value) missing.push(name);
  return value;
}

function requiredUrl(
  environment: Environment,
  name: string,
  missing: string[],
): string | undefined {
  const value = requiredValue(environment, name, missing);
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      missing.push(name);
      return undefined;
    }
    return value;
  } catch {
    missing.push(name);
    return undefined;
  }
}

export function getAuth0Configuration(
  environment: Environment = process.env,
): Auth0Configuration {
  const missing: string[] = [];
  const domain = requiredValue(environment, "AUTH0_DOMAIN", missing);
  const clientId = requiredValue(environment, "AUTH0_CLIENT_ID", missing);
  const appBaseUrl = requiredUrl(environment, "APP_BASE_URL", missing);
  const secret = requiredValue(environment, "AUTH0_SECRET", missing);
  const issuerBaseUrl = requiredUrl(
    environment,
    "AUTH0_ISSUER_BASE_URL",
    missing,
  );
  const clientSecret = environment.AUTH0_CLIENT_SECRET?.trim();
  const clientAssertionSigningKey =
    environment.AUTH0_CLIENT_ASSERTION_SIGNING_KEY?.trim();
  if (!clientSecret && !clientAssertionSigningKey) {
    missing.push("AUTH0_CLIENT_SECRET or AUTH0_CLIENT_ASSERTION_SIGNING_KEY");
  }

  if (
    missing.length ||
    !domain ||
    !clientId ||
    !appBaseUrl ||
    !secret ||
    !issuerBaseUrl
  ) {
    throw new Auth0ConfigurationError([...new Set(missing)]);
  }

  return {
    domain,
    clientId,
    ...(clientSecret ? { clientSecret } : { clientAssertionSigningKey }),
    appBaseUrl,
    secret,
    issuerBaseUrl,
  };
}

export function createAuth0Client(
  configuration: Auth0Configuration = getAuth0Configuration(),
): Auth0Client {
  return new Auth0Client({
    domain: configuration.domain,
    clientId: configuration.clientId,
    clientSecret: configuration.clientSecret,
    clientAssertionSigningKey: configuration.clientAssertionSigningKey,
    appBaseUrl: configuration.appBaseUrl,
    secret: configuration.secret,
  });
}
