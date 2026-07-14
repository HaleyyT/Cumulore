export type IdentityClaim = {
  issuer: string;
  subject: string;
  email?: string;
};

export interface IdentityProviderAdapter {
  getIdentity(): Promise<IdentityClaim | null>;
}
