import { Auth0IdentityProviderAdapter } from "./auth0-identity-provider.js";
import { FakeIdentityProviderAdapter } from "./fake-identity-provider.js";
import type { IdentityProviderAdapter } from "./types.js";

export function createIdentityProviderAdapter(): IdentityProviderAdapter {
  if (process.env.IDENTITY_PROVIDER === "auth0")
    return new Auth0IdentityProviderAdapter();
  return new FakeIdentityProviderAdapter(null);
}

export type { IdentityClaim, IdentityProviderAdapter } from "./types.js";
export { FakeIdentityProviderAdapter } from "./fake-identity-provider.js";
