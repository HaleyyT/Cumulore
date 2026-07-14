import { Auth0Client } from "@auth0/nextjs-auth0/server";

import type { IdentityClaim, IdentityProviderAdapter } from "./types.js";

export class Auth0IdentityProviderAdapter implements IdentityProviderAdapter {
  constructor(private readonly client = new Auth0Client()) {}

  async getIdentity(): Promise<IdentityClaim | null> {
    const session = await this.client.getSession();
    if (!session?.user.sub) return null;
    const separator = session.user.sub.indexOf("|");
    const issuer = process.env.AUTH0_ISSUER_BASE_URL;
    if (!issuer || separator < 1)
      throw new Error("Auth0 issuer configuration is required");
    return {
      issuer,
      subject: session.user.sub,
      email: session.user.email,
    };
  }
}
