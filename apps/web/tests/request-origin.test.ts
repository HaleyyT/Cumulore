import assert from "node:assert/strict";

import {
  assertTrustedRequestOrigin,
  RequestSecurityError,
} from "../src/modules/security/request-origin.js";

const requestUrl = "https://app.cumulore.test/api/sources";

assert.doesNotThrow(() =>
  assertTrustedRequestOrigin({
    method: "POST",
    requestUrl,
    origin: "https://app.cumulore.test",
    fetchSite: "same-origin",
  }),
);
assert.doesNotThrow(() =>
  assertTrustedRequestOrigin({ method: "GET", requestUrl, origin: null }),
);
assert.doesNotThrow(() =>
  assertTrustedRequestOrigin({
    method: "POST",
    requestUrl,
    origin: "https://preview.cumulore.test",
    allowedOrigins: ["https://preview.cumulore.test"],
  }),
);
for (const context of [
  { method: "POST", requestUrl, origin: null },
  {
    method: "POST",
    requestUrl,
    origin: "https://evil.example",
    fetchSite: "cross-site",
  },
  { method: "DELETE", requestUrl, origin: "not a URL" },
]) {
  assert.throws(
    () => assertTrustedRequestOrigin(context),
    (error) => error instanceof RequestSecurityError,
  );
}

console.log("Request origin policy tests passed.");
