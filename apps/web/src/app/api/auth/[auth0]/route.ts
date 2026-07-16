import type { NextRequest } from "next/server";
import type { Auth0Client } from "@auth0/nextjs-auth0/server";
import { createAuth0Client } from "../../../../modules/identity/auth0-config";

let client: Auth0Client | undefined;

function getClient(): Auth0Client {
  return (client ??= createAuth0Client());
}

export function GET(request: NextRequest) {
  return getClient().middleware(request);
}
