# Phase 3: JWT authentication and session lifecycle

**2026-10-26 recovery update:** Refresh now returns the verified user alongside its
existing session summary. See [performance-phase3.md](performance-phase3.md) for
the current contract, recovery/freshness behavior and backend-first rollout.

**2026-10-26 performance update:** Session projections now use a shared-lock database
authorization function; ordinary business routes authorize and execute in one
transaction. Refresh retains exclusive locking and post-callback DB-clock checks.
Apply the new migration before deploying the backend. See
[performance-phase2.md](performance-phase2.md) for current transaction ownership,
verification evidence and rollout order; it supersedes historical transaction
guidance below.

**2026-10-01 extraction:** The implementation described below now lives under `apps/api/src` in the standalone Node.js service. Follow [B1 setup](backend-b1-extraction.md) for current environment locations and commands. Live Supabase verification remains pending. Public student registration is planned in B5 under the revised [B0 contract](backend-b0-contract.md).

**Status:** Backend implementation complete with configuration placeholders. Live Supabase connection and verification are deferred by the user's choice. No cloud resources or accounts have been created, and the migration has not been applied to a hosted database.

Read together with the [Phase 2 foundation](api-phase-2-foundation.md) and [Phase 1 contract](api-phase-1-contract.md). Phase 1 takes precedence over the draft plan's suggestion to store application-owned refresh-token hashes: Supabase owns issuance, rotation, and reuse detection.

## Scope

Implemented:

- `GET /api/auth/csrf` and `POST /api/auth/login`, `/refresh`, `/logout`.
- `GET /api/auth/me`, using the wrapper's server-verified actor.
- Asymmetric JWT verification, pinned project JWKS, live provider/account/session checks, server-managed cookies, origin checks, signed CSRF binding, persistent application sessions, shared login counters, and revocation/cleanup primitives.
- A private PostgreSQL migration, restricted runtime privileges, account-change revocation triggers, and an operator-only cleanup function.

Phases 4–7 remain unstarted. No permission matrix, business endpoints, general feature schemas, audit system, frontend API client, protected-page migration, invitation UI, or recovery endpoints were added. The existing login/OTP/local-storage UI and rendered dashboards are still prototypes and must not be treated as protected production screens. Local storage has no authority over the new backend.

Credential provisioning and password recovery remain the companion tasks called out in the plan. The future reset flow must consume its recovery grant and invoke `revokeAll(accountId)` before reporting completion; this phase supplies that revocation primitive, not a working reset flow. Supabase-side session removal is also detected on every authenticated request.

## Modules

| Module | Responsibility |
| --- | --- |
| `src/server/auth/config.ts` | Explicit opt-in configuration and safe validation |
| `jwt.ts` | Signature, algorithm, issuer, audience, timing, subject/session UUID verification |
| `cookies.ts` | Credential cookies, signed browser binding, CSRF token and origin validation |
| `provider.ts` | Server-only Supabase password/refresh/local-logout HTTP adapter |
| `store.ts` | Restricted PostgreSQL queries, transaction locks, sessions, counters, revocation |
| `service.ts` | Authentication flows and safe user/session projections |
| `runtime.ts` | Lazy server singleton; no browser Supabase client |
| `input.ts` | Minimum strict input checks needed to safely expose the auth endpoints |
| `supabase/migrations/202609290001_phase3_auth.sql` | Private account/profile/session storage and provider-state bridge |

All authentication modules import `server-only`. Dependencies are `jose` and `pg`; PGlite is a development dependency used to execute PostgreSQL tests without a live project.

## Configuration placeholders

Copy `.env.example` to an untracked `.env.local`, or add variables to an existing local file. `AUTH_ENABLED=false` is the default; auth endpoints and protected requests return the standard JSON `503 SERVICE_UNAVAILABLE`. There is no demo identity fallback. Startup validates enabled configuration without connecting to the provider or database.

| Variable | Requirement |
| --- | --- |
| `APP_ORIGIN` | Existing exact origin; HTTPS in production |
| `AUTH_ENABLED` | Set `true` only after setup below |
| `SUPABASE_URL` | Hosted project origin, `https://<project-ref>.supabase.co`; custom/self-hosted domains are not enabled in this implementation |
| `SUPABASE_PUBLISHABLE_KEY` | Project publishable key, used only on the server here; privileged service keys are unnecessary for these four auth flows |
| `SUPABASE_JWT_ALGORITHMS` | Explicit `ES256`, `RS256`, or comma-separated allowlist matching the project's asymmetric signing keys; HS256 rejected |
| `DATABASE_URL` | Restricted login connection, using direct PostgreSQL or a session pooler; no URL query options; certificate-verified TLS is enforced |
| `AUTH_COOKIE_SECRET` | 32 cryptographically random bytes as 64 hex characters; stable across deployments and identical across instances |
| `AUTH_TRUSTED_IP_HEADER` | Required in production: one IP address supplied by a trusted ingress that removes/overwrites caller input; arbitrary forwarded chains are rejected |

Generate the cookie secret locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and put it only in secret storage. It authenticates browser/CSRF bindings; it does **not** sign identity JWTs. No Supabase private signing keys are copied into the application.

No trusted IP header in development means one shared, conservative development IP bucket. Do not enable a caller-controlled header on an internet-facing deployment. The deployment must exclude credentials, cookies, recovery proofs, and raw request URLs with sensitive query values from its own logs.

## Connecting the development project later

1. Configure Supabase email/password Auth, disabled public signup, verified test emails, and an asymmetric signing key. Set access JWT lifetime to **900 seconds**; this verifier rejects longer-issued tokens. Retain provider refresh reuse detection and its documented reuse interval. Provider timeouts must not undercut the intended remembered-student limits unless deliberately accepting a shorter session.
2. Apply the migration once as the trusted database operator. Its provider-state function assumes Supabase's `auth.users`, `auth.sessions`, and `auth.refresh_tokens` schema. Review those columns and operator permissions against the connected project before applying. Application tables stay in `gethired_private`, excluded from exposed Data API schemas, Realtime publications, and bypassing RPC/Storage policies.
3. Create a dedicated database **login** through the operator/secret-management workflow and grant it membership in the migration's `gethired_runtime` role. Use that login in `DATABASE_URL`; never use the database owner or service role for ordinary application queries. The runtime can read account/profile rows, maintain sessions/counters/cleanup records, and call narrowly scoped provider-state/locking functions. It cannot change account roles or statuses, read Auth credential tables, or run privileged provider cleanup.
4. Provision a verified test identity through Supabase's trusted operator tools. Create its mapped account with `auth_user_id`, email, display name, exact role (`student` or `admin`), and active status. For a student, add its profile and eight-digit student number. The account UUID is the application actor; the provider subject is a separate UUID. No seeded passwords, default administrator, public signup route, or automatic role assignment is provided.
5. Set the environment variables, enable auth, restart, and exercise the sequence below. Before production, also configure the ingress IP header and a scheduled operator cleanup job. Email invitations/recovery templates and browser integration are still companion work.

The migration's operator-only `gethired_private.process_provider_cleanup(100)` processes pending provider-session termination tasks. Schedule it with a trusted database operator, outside the web runtime; it can also be run manually for a development project. It deletes refresh credentials and the precisely identified provider session, preserving other devices. Local revocation and its cleanup task commit together, so a failed provider call cannot restore access. Cleanup records contain UUIDs only. This function touches managed Auth tables and must be reviewed when upgrading Supabase Auth; its privileges must never be granted to browser roles or the application login.

Operators should prune expired `auth_limits` rows and completed cleanup records on a maintenance schedule. Retention/audit policy remains Phase 6 work.

## Browser protocol and lifecycle

1. Fetch `/api/auth/csrf` with same-origin credentials. Store the returned CSRF token in memory; the server sets an HttpOnly signed browser-binding cookie.
2. POST login with JSON `{ identifier, password, rememberMe }`, exact `Origin`, and `X-CSRF-Token`. Identifiers are trimmed; passwords are forwarded unchanged. Omitted Remember me is false. Unknown user, incorrect password, inactive account, unverified email, and incomplete account/profile provisioning all produce `401 INVALID_CREDENTIALS` after credential verification.
3. Login sets access, refresh, and a newly bound browser cookie. Its response contains only `{ user, session }`. Fetch CSRF again after login because the old token is invalidated. `/auth/me` returns the current trusted database role/profile and absolute expiry.
4. POST refresh with `{}` and the current CSRF token. The refresh cookie plus signed session binding is sufficient when the access JWT expires or is missing. A database row lock serializes refreshes across application instances. The returned verified provider identity/session must match the existing active session; refresh never creates an application session or extends its original deadline.
5. POST logout with `{}` and CSRF. It accepts an anonymous binding or an authenticated binding with expired/missing access credentials. For a bound session, local revocation must commit before cookie clearing. Provider local logout is attempted when a valid JWT is available; otherwise the durable operator cleanup task remains pending. Fetch CSRF first if stale cookies no longer contain a valid binding.

The later frontend must serialize refresh within the browser **and across tabs** (for example, a shared Web Lock), then re-read current browser state after acquiring it. Backend serialization does not prevent delayed HTTP responses from overwriting newer cookies. Duplicate refreshes are left to Supabase's documented reuse rules; only its explicit confirmed-reuse code triggers local replay revocation. The embedded tests exercise serialized requests, not real multi-process lock contention or Supabase's production reuse implementation.

Production cookies use `__Host-gethired-*`, HttpOnly, Secure, SameSite=Lax, Path=/, and no Domain. HTTP development uses separate `gethired-dev-*` names. Remembered student cookies have Max-Age bounded by the original remaining absolute lifetime. Administrator and non-remembered cookies are browser-session cookies; browser restoration can preserve them, so server expiry remains authoritative.

| Session | Absolute | Idle | Remember me |
| --- | --- | --- | --- |
| Student, ordinary | 8 hours | 30 minutes | Off |
| Student, remembered | 30 days | 7 days | On |
| Administrator | 8 hours | 30 minutes | Ignored |

`/auth/me` and refresh do not update idle activity. Future user-driven business endpoints can declare `activity: "user"`; the wrapper touches activity only after successful response construction. Background polling must leave that option unset. Sensitive future writes must recheck account/session state inside their own transaction; a wrapper check is not a substitute for the Phase 4/7 service policy.

Every protected request verifies the JWT **and** checks the mapped active account, nonrevoked application session, deadlines, verified/unbanned provider user, and live provider session. A correctly signed but revoked token is denied. Provider/database failures return safe 503 responses. Account status/role changes revoke every existing application session through a database trigger; reactivation cannot restore them.

Supported mutation methods now receive browser protection in the shared wrapper before authentication/body parsing. Origin must exactly equal configuration; missing origin fails. CSRF uses an HMAC tied to the signed anonymous/authenticated browser binding and rotates on login. Cross-site CSRF bootstrap requests are rejected. No cross-origin CORS headers are emitted. Future recovery verification must issue a separate recovery-only binding and never mint an ordinary application session.

Login counters are shared in PostgreSQL: five failed/reserved attempts per normalized identifier per 15-minute window, and 30 attempts per trusted IP per window. Successful login releases its identifier reservation. Email and student-number aliases share the mapped email's bucket. Counter keys are HMACs, not stored email/IP values. Invalid input does not invoke provider authentication. Recovery counters are deferred with recovery endpoints.

## Key rotation

Supabase owns private signing keys. Publish a replacement asymmetric key, allow its configured algorithm, and follow the provider's staged rotation process. The verifier pins `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`, caches public keys for up to five minutes, allows at most 30 seconds of timing skew, and never uses token-supplied `jku`/`x5u`. Keep the old public key available through the longest issued JWT lifetime plus cache/skew margins, following the provider's current rotation guidance. Emergency key revocation may require restarting instances to discard cached keys and revoking affected application sessions.

Rotating `AUTH_COOKIE_SECRET` invalidates existing browser bindings and CSRF tokens, requiring fresh login. It does not terminate provider sessions by itself; coordinate session revocation/cleanup during a security rotation. Never generate this secret during server startup.

## Verification

Automated coverage includes the Phase 2 contract suite plus real cryptographic JWT tests, provider-adapter tests, cookies/origin/CSRF failures, and PostgreSQL migration/lifecycle tests through PGlite. The database fixture supplies a minimal Auth schema; no real Supabase credentials are used. The tests execute application queries as `gethired_runtime` and verify the privilege boundary.

Run `npm test`, `npm run typecheck`, and `npm run build` with a production HTTPS `APP_ORIGIN`. The build may use `AUTH_ENABLED=false` until connection setup. Live login, hosted schema compatibility, ingress-header trust, email delivery, multiple database connections, and provider refresh reuse behavior must be verified when connecting Supabase.

Completed locally on 2026-09-29:

- **35 automated tests passed**, including the unchanged Phase 2 behavior and the PostgreSQL/cryptographic checks described above.
- **TypeScript validation and production build passed.** All five auth endpoints are dynamic server routes.
- **15 production HTTP checks passed** against a local Next.js production server with enabled placeholder configuration: CSRF bootstrap/cookie flags, absent and forged identity, missing/untrusted origins, input/media/body limits, anonymous refresh/logout, method handling, and JSON 404/cache/request-ID contracts. Re-run with `node tests/auth-http-smoke.mjs` against `http://localhost:3103` (or set `AUTH_SMOKE_URL` to another local port). The smoke script submits no valid login credentials and does not require a live database/provider.

The installed `oxfmt` version removed separators from some inline TypeScript types during formatting. That output was corrected, unrelated formatting changes were removed from existing files, and compiler/tests/build were rerun successfully. Upgrading the formatter is outside this phase.

References: [Supabase sessions and revocation](https://supabase.com/docs/guides/auth/sessions), [JWT signing keys](https://supabase.com/docs/guides/auth/signing-keys), [local sign-out](https://supabase.com/docs/guides/auth/signout), [Auth error codes](https://supabase.com/docs/guides/auth/debugging/error-codes), and [Auth HTTP API](https://github.com/supabase/auth/blob/master/openapi.yaml).
