import assert from "node:assert/strict";

import { FakeIdentityProviderAdapter } from "../src/modules/identity/index.js";

const claim = {
  issuer: "https://fake.identity.local/",
  subject: "fake|student",
  email: "old@example.test",
};
const adapter = new FakeIdentityProviderAdapter(claim);
assert.deepEqual(await adapter.getIdentity(), claim);
assert.equal(await new FakeIdentityProviderAdapter(null).getIdentity(), null);
