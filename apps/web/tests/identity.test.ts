import assert from "node:assert/strict";

import {
  Auth0ConfigurationError,
  FakeIdentityProviderAdapter,
  IdentityConfigurationError,
  createIdentityProviderAdapter,
} from "../src/modules/identity/index.js";

const claim = {
  issuer: "https://fake.identity.local/",
  subject: "fake|student",
  email: "old@example.test",
};
const adapter = new FakeIdentityProviderAdapter(claim);
assert.deepEqual(await adapter.getIdentity(), claim);
assert.equal(await new FakeIdentityProviderAdapter(null).getIdentity(), null);
assert.ok(
  createIdentityProviderAdapter({ IDENTITY_PROVIDER: "fake" }) instanceof
    FakeIdentityProviderAdapter,
);
assert.throws(
  () => createIdentityProviderAdapter({ IDENTITY_PROVIDER: "auth0" }),
  (error: unknown) =>
    error instanceof Auth0ConfigurationError &&
    error.code === "AUTH0_CONFIGURATION_INVALID" &&
    error.message === "Auth0 configuration is incomplete",
);
assert.throws(
  () => createIdentityProviderAdapter({ IDENTITY_PROVIDER: "unsupported" }),
  (error: unknown) => error instanceof IdentityConfigurationError,
);
