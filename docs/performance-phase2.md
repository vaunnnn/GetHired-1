# Phase 2: consolidate authorization and SQL round trips

Implemented and verified locally on 2026-10-26. This increment implements Phase 2
of [the performance plan](performance-implementation-plan.md). It changes backend
authorization/transaction internals; browser request/response shapes and credential
rotation remain unchanged. Hosted migration and live latency comparison are pending.

## Result

| Successful path | Original SQL protocol calls | Phase 2 calls | Reduction |
| --- | ---: | ---: | ---: |
| Session projection (`authenticate` / `/auth/me`) | 10 | 4 | 60% |
| Generic exclusive session callback with activity update | 11 | 5 | 55% |
| Routed company list, including authorization and activity | 22, two transactions | 6, one transaction | 73% |

These are executed client SQL calls, not counts of internal PostgreSQL statements
or promises of production latency. The SQL audit ran 45 measured cases with zero,
25 ms and 75 ms injected delay per call, and asserted exact attribution counts.
Both admin and student company-list paths also have automated six-call regressions.
Evidence: [phase2-sql-1793018990191.json](performance/phase2-sql-1793018990191.json).
The original live and Phase 1 local evidence remain separate.

## Authorization and transaction ownership

`gethired_private.authorize_session` is the single SQL authorization primitive.
It uses the existing runtime table grants and existing narrowly privileged account
lock/provider-state bridges. The function itself is SECURITY INVOKER with an empty
search path; public, anon and authenticated cannot execute it. It returns an
explicit safe principal projection or a fixed denial code, never provider credentials.

It resolves the session's account, locks the account before the session, and checks
active status, the credential barrier, identity binding, session ownership,
revocation, idle/absolute expiry, provider liveness and student-profile availability.
Database time is evaluated in a separate PL/pgSQL statement after lock acquisition.
Provider liveness now uses the current database clock rather than transaction-start
`now()`, including when rechecking after slow external work.

`AuthStore.readSession` uses shared account and session locks for ordinary session
projection. It performs one validation and no activity write or generic callback.
Shared readers can overlap; account changes and session revocation still wait for
the authorization transaction before taking effect. The next authorization denies
revoked/deactivated/blocked sessions. This was verified against real PostgreSQL,
not inferred from PGlite.

`withSession` retains exclusive session locking for refresh and generic callbacks.
After a successful callback it calls the same primitive again, checking current
database expiry and provider state before any activity update or commit. Refresh
still does not touch activity. A replay callback's returned `ApiError` still commits
its explicit revocation, and the service throws that denial after commit. Provider
errors still roll back and preserve their safe error codes.

Ordinary company/bookmark, category/question/pipeline and student-registry routes
declare `access.transaction: "business"` alongside their explicit permission.
`withAuthorization` verifies the JWT and signed browser/session binding once, opens
one transaction and obtains the current principal. The handler receives an explicit
`ApiContext.authorization`, passed as the repository method's final argument.
Repositories reassert their permissions and retain all resource/owner predicates.
The context is only usable with the same pool and exact principal while its callback
is active; forged, cross-account and expired contexts fail closed. No shared cache
or ambient principal grants authorization.

Response serialization occurs inside this transaction. Handler, validation,
permission or serialization failure rolls back business work and idle activity.
After success, a final database authorization check atomically updates deliberate
user activity before commit. Repository calls without a context still obtain their
own full authorization transaction; a cached principal cannot bypass checks.

Image upload and invitation delivery keep their existing boundaries around external
storage/provider work. They authenticate before side effects and reauthorize each
database phase; they do not hold one route-wide database transaction across external
calls. Their request chains are not covered by the six-call company-list claim.

Both transaction timeouts retain their existing values (5-second lock timeout,
10-second statement timeout), configured together in one SQL call. The five-client
production pool limit is unchanged.

## Observability

Phase 1 request IDs, safe errors and timing headers remain available. The two
`set_config` calls in one statement count as one `db_control` protocol call.
Authorization-function calls are attributed to `db_auth`; their internal locks,
projection and provider checks no longer have separate client SQL timings.
Do not interpret a missing `db_lock` metric as evidence of no lock wait. Use the
database wait diagnostics described in [Phase 1](performance-observability.md).
Business-callback SQL still has its own `db_business` attribution.

## Verification

All commands use Node 22.14.0:

| Check | Evidence |
| --- | --- |
| `npm run typecheck` | Frontend, shared contracts and API passed |
| `npm test` | 77 backend and 19 frontend tests passed; 96 total |
| `npm run build` and `npm run build:api` | Production builds passed |
| `npm run test:browser` | Existing two-role, two-tab session/business browser smoke with isolated HTTP fixtures |
| `node --import tsx tests/session-sql-audit.ts` | 45 actual-code PGlite cases; 4/5/6 call counts and revoked-session denial |
| `node --import tsx tests/session-postgres-audit.ts` | 13 checks against disposable local PostgreSQL 17.11 using independent runtime/operator connections |

The full suite covers deactivation/reactivation, role change, provider logout,
password reset, credential blocking, revocation, idle/absolute expiry, refresh
replay/concurrency, ownership and audit rollback. New route tests cover transaction
reuse, both roles' exact call counts, permission denial before parsing, failed
serialization rollback, and invoker-function/private-role restrictions.

The real PostgreSQL checks hold transactions open to demonstrate overlapping shared
reads. They observe `pg_stat_activity.wait_event_type = 'Lock'` for contending
writers/refreshes, rather than infer blocking from elapsed time alone. They verify
revocation/account-change ordering, exclusive refresh callbacks, expiry after
real session-row lock waits, application/provider expiry after callbacks, rollback
on provider logout, committed replay revocation, and activity semantics. Evidence:
[phase2-postgres.json](performance/phase2-postgres.json).

These local PostgreSQL tables model the provider schema already used by repository
tests. They do not validate a particular hosted Supabase Auth schema/version, remote
JWT/JWKS outages, provider token-rotation timing, hosting placement or production
percentiles. The HTTP browser fixture checks browser behavior, not database locks.

To reproduce concurrency checks without touching a live database:

```powershell
docker run --detach --rm --name gethired-phase2-postgres --publish 127.0.0.1:55432:5432 --env POSTGRES_HOST_AUTH_METHOD=trust postgres:17
node --import tsx tests/session-postgres-audit.ts
docker stop gethired-phase2-postgres
```

The script creates and drops a uniquely named test database, accepts only a loopback
`PHASE2_POSTGRES_URL`, and uses no production credentials. The container has no
host-mounted data and is removed when stopped. Use this command with the disposable
instance, not an existing developer database containing application data.

## Deployment order and remaining acceptance

1. As the trusted database operator, apply
   `supabase/migrations/202610260001_session_authorization.sql` after existing B6
   migrations. Review compatibility with the hosted provider tables. No migration
   was applied to a hosted database in this implementation run.
2. Deploy a preview backend. Readiness now requires schema marker `202610260001`;
   deploying the backend before the migration will intentionally fail readiness.
   The migration retains existing tables/functions and is compatible with the
   previous backend, so migrate first.
3. Run both roles and concurrent read/refresh/revocation cases against staging,
   using Phase 1 request-ID/timing attribution. Capture at least 30 samples per
   target scenario before deciding production p95/success-rate gates.
4. Compare the same deployment topology to the original baseline. The plan's live
   median reduction and error-rate gates remain unmeasured. Promote this SQL/auth
   increment separately from Phase 3/4 client changes.

For an application rollback, redeploy the previous backend while retaining the
additive function/migration marker. The old code still takes exclusive read locks
and uses the existing provider bridge. Removing the migration is a separate operator
action and is not needed for that application rollback.
