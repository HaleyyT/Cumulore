import { Auth0IdentityProviderAdapter } from "./auth0-identity-provider.js";
import { getAuth0Configuration } from "./auth0-config.js";
import { FakeIdentityProviderAdapter } from "./fake-identity-provider.js";
import type { IdentityProviderAdapter } from "./types.js";

type Environment = Record<string, string | undefined>;

export class IdentityConfigurationError extends Error {
  readonly code = "IDENTITY_CONFIGURATION_INVALID" as const;

  constructor() {
    super("IDENTITY_PROVIDER must be either fake or auth0");
    this.name = "IdentityConfigurationError";
  }
}

export function createIdentityProviderAdapter(
  environment: Environment = process.env,
): IdentityProviderAdapter {
  const mode = environment.IDENTITY_PROVIDER ?? "fake";
  if (mode === "auth0") {
    return new Auth0IdentityProviderAdapter({
      configuration: getAuth0Configuration(environment),
    });
  }
  if (mode === "fake") return new FakeIdentityProviderAdapter(null);
  throw new IdentityConfigurationError();
}

export type { IdentityClaim, IdentityProviderAdapter } from "./types.js";
export { FakeIdentityProviderAdapter } from "./fake-identity-provider.js";
export { Auth0ConfigurationError } from "./auth0-config.js";
