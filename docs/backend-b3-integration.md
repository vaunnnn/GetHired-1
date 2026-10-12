# B3 authorization and session integration

Status (2026-10-12): implemented and validated locally. The new migration and B3
application revisions have not been applied/deployed to hosted staging in this session.
Remaining B2 hosted acceptance checks are not implicitly completed by this work.

## Behavior

- Login uses `/api/auth/login`, defaults Remember me off, displays safe API errors,
  and navigates using the backend role. Profiles use `/auth/me`; logout revokes the
  session before leaving the workspace.
- `/dashboard` and `/admin` are dynamic, private/no-store pages. Server checks call
  `/auth/me` through the gateway with incoming cookies and the configured ingress IP.
  They never refresh or mutate cookies during rendering. Wrong roles see access
  denied; outages show a retry view instead of pretending credentials failed.
- Expired access uses browser recovery then retries navigation. A same-origin Web
  Lock serializes cookie-changing requests. Inside the lock, refresh checks `/auth/me`
  again in case another tab already refreshed. CSRF is fetched against the current
  binding and fetched again after login/refresh. BroadcastChannel carries only a
  change notification, never identity. Tabs recheck on focus, visibility, page
  restoration and every visible minute.
- Requires a current browser supporting Web Locks on HTTPS (localhost works for
  development). Unsupported browsers fail with an explicit message. There is no
  local-storage identity or unsafe uncoordinated refresh fallback.
- Only reads retry a transient failure once; mutations are never automatically
  replayed. Profile checks and refresh do not extend idle sessions. Future business
  requests use the existing activity contract or authorized transaction helper.
- Signup and password reset explicitly show unavailable until B5. Company/student/
  interview screens still contain prototype feature data until B4–B7. Existing
  prototype registry/password displays are not real credentials or provisioning.

## Backend foundations

`authorization/policy.ts` centralizes permissions and student ownership. Protected
routes require a known explicit permission; business namespaces cannot declare public
access. Administrators have no override for private student attempts. Queries must
also include the authenticated owner's ID in their WHERE clause.

`db/transaction.ts` provides bounded transactions and an authorized write transaction
that locks account then session, rechecks active status, role, identity, absolute/idle
expiry and provider state, and records activity after success. Feature writes, audit
inserts and outbox inserts belong in this same transaction. Existing authentication
transactions also use the shared helper.

`api/validation.ts` supplies strict objects, field parsers, UUIDs, enums and pagination.
Feature schemas reject unknown fields; PATCH uses optional parsers with empty-object
rejection enabled.

The migration adds append-only audit storage and an outbox containing only static
action/topic names and UUID identifiers. Helpers accept no credentials, interview
content or arbitrary request bodies. Runtime can append but cannot read/change audit
history or inspect/claim jobs.

A separate `gethired_outbox_worker` role calls bounded claim/finish functions. Claims
use `SKIP LOCKED`, five-minute leases and unique lease tokens. Expired leases can be
reclaimed; stale workers cannot finish a newer lease. Delayed retries stop after ten
attempts; operators investigate exhausted jobs. Delivery is at least once: future
handlers must be idempotent and finish within a lease. B3 adds primitives, not an
email worker; provision a worker login when implementing handlers in later phases.

## Deployment order

1. As trusted operator in the staging Supabase SQL editor, apply
   `supabase/migrations/202610120001_b3_feature_foundation.sql` once after B2.
   Keep `gethired_private` unexposed. Runtime credentials cannot migrate.
2. Deploy the API revision to Render. Readiness now requires schema marker
   `202610120001`. Existing environment settings and runtime login remain valid.
3. Verify Render `/api/health/ready`, then deploy the frontend revision to Vercel.
   Confirm the existing origin, gateway secret and ingress settings still match.
4. On the HTTPS origin, use the provisioned staging student/admin to check login,
   profile, logout, role denials, access-token expiry across tabs and revocation.
   Complete outstanding B2 ingress/provider/worker checks.

Rollback: restore previous matched application revisions; retain the additive
migration. Do not remove audit/outbox records, accounts or sessions.

## Validation

- `npm test`: 47 backend tests plus 15 client/proxy/page-session tests pass.
  Embedded PostgreSQL covers migration grants, audit immutability, deduplication,
  rollback, leases/retries and revoked-account write denial. Existing authentication
  tests cover provider/JWT behavior, expiry, CSRF, role changes and reset revocation.
- `npm run typecheck`, `npm run build:api`, `npm run build` pass.
- `npm run test:http`: 18 production topology checks pass.
- `npm run test:browser` after frontend build: headless Chrome with production Next.js
  and a local HTTP fixture covers fake local-storage denial, invalid/valid login,
  Remember me default, profile, server role denial, two-tab refresh, logout propagation,
  outage view and unavailable signup. Set `CHROME_PATH` for a nondefault installation.
  The fixture is test-only; the application contains no authentication bypass.
- Local runtime: Node 24.14.1; deployment remains pinned to Node 22.22.0.
  Fixtures and embedded PostgreSQL do not replace live Supabase authentication or
  hosted multi-connection locking acceptance.

References: [Next.js cookie restrictions](https://nextjs.org/docs/app/api-reference/functions/cookies),
[Web Locks across tabs](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API).
