import { Auth0Client } from "@auth0/nextjs-auth0/server";

import {
  createAuth0Client,
  getAuth0Configuration,
  type Auth0Configuration,
} from "./auth0-config.js";
import type { IdentityClaim, IdentityProviderAdapter } from "./types.js";

export class Auth0IdentityProviderAdapter implements IdentityProviderAdapter {
  private readonly client: Auth0Client;
  private readonly issuerBaseUrl: string;

  constructor(
    options: {
      readonly client?: Auth0Client;
      readonly configuration?: Auth0Configuration;
    } = {},
  ) {
    const configuration = options.configuration ?? getAuth0Configuration();
    this.client = options.client ?? createAuth0Client(configuration);
    this.issuerBaseUrl = configuration.issuerBaseUrl;
  }

  async getIdentity(): Promise<IdentityClaim | null> {
    const session = await this.client.getSession();
    if (!session?.user.sub) return null;
    return {
      issuer: this.issuerBaseUrl,
      subject: session.user.sub,
      email: session.user.email,
    };
  }
}
