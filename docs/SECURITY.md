# Security Foundation

**Status:** Milestone 2A-H baseline

## Authorities and trust boundaries

- Auth0 authenticates an external identity. Cumulore maps issuer and subject to
  an account-level user; Auth0 metadata and roles do not authorize workspaces.
- `workspace_members` is the workspace authorization authority. Application
  commands check membership and pass explicit workspace predicates; forced RLS
  and composite tenant keys provide independent database enforcement.
- The web role cannot claim jobs or call cross-workspace operational functions.
  The worker receives only narrow function grants and sets the authoritative
  claimed workspace before workspace-owned reads or effects.
- The migration role owns schema objects and is never a runtime credential.

## Browser and API boundary

Future state-changing route handlers must perform these checks in order:

1. Validate method, content type, body size, and runtime schema.
2. Enforce the trusted-origin policy for browser requests.
3. Resolve an authenticated account from the identity adapter.
4. Resolve the requested workspace and active database membership.
5. Invoke an application command with explicit actor/workspace context and,
   where retryable by clients, an idempotency key.

The origin check does not replace authentication, authorization, idempotency,
or RLS. Missing, malformed, cross-site, and unapproved origins fail closed for
state-changing methods. Safe read methods remain usable by non-browser clients.

## Upload boundary

- The current limit is 50 MiB and one-hour maximum session expiry.
- Format and content type must match: PDF uses `application/pdf`; TXT uses
  approved `text/plain` variants; pasted text uses the internal pasted-text
  content type.
- IDs, non-empty title, safe integer size, expiry, and optional 32-byte SHA-256
  digest are validated before a transaction. PostgreSQL repeats durable
  constraints and workspace authorization.
- Quarantine keys are generated server-side. Original bytes remain untrusted
  and cannot alter system, workspace, or extraction instructions.

## Error and telemetry boundary

Public errors expose only a stable code and generic public message. Private
diagnostics may contain stack traces in controlled development output but must
not contain request bodies or private source data.

Structured operational fields are allow-listed. Never log or label metrics
with source content, filenames, workspace/user identifiers, prompts, tokens,
cookies, signed URLs, credentials, or arbitrary provider/database error text.

## Adversarial verification matrix

| Attempt                                                      | Required result                                |
| ------------------------------------------------------------ | ---------------------------------------------- |
| Missing or forged workspace context                          | Hidden or denied by explicit predicate and RLS |
| Inactive membership                                          | Denied even with a valid user session          |
| Cross-workspace folder/upload/source ID                      | Denied without revealing existence             |
| Worker direct mutation outside granted functions             | Denied                                         |
| Web execution of claim/metrics functions                     | Denied                                         |
| Missing, malformed, or cross-site origin on browser mutation | Denied before command execution                |
| Invalid upload format/type/size/expiry/digest                | Rejected before database work                  |
| Replayed idempotency key with a different request hash       | Conflict without mutation                      |
| Sensitive value offered as a structured-log field            | Impossible through the allow-listed API        |
