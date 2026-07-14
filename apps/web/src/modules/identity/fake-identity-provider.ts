import type { IdentityClaim, IdentityProviderAdapter } from "./types.js";

export class FakeIdentityProviderAdapter implements IdentityProviderAdapter {
  constructor(private readonly claim: IdentityClaim | null) {}

  async getIdentity(): Promise<IdentityClaim | null> {
    return this.claim;
  }
}
