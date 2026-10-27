# Performance attribution: Phase 1

Phase 2 update: [performance-phase2.md](performance-phase2.md) documents the new
authorization function and verified call counts. Internal function locks now fall
under `db_auth`; the Phase 1 10/11/22 counts below describe the retained baseline.
Real local PostgreSQL concurrency checks have since passed; hosted wait analysis
and live comparisons remain pending.

Implemented locally on 2026-10-26. This is the first increment of
[the performance plan](performance-implementation-plan.md). Production comparison
and PostgreSQL wait analysis remain pending; this increment supplies the measurements
needed before changing authorization, locks, hosting placement or pool limits.

## Response and log contract

API responses expose optional `Server-Timing` metrics with static names and numeric
durations in milliseconds. The gateway forwards only approved numeric metrics and
adds its own timings. JSON envelopes, request IDs, cookies, private cache directives,
authorization checks and SQL statement ordering retain their existing contracts.
The OpenAPI document includes the optional response header.

| Metric | Meaning |
| --- | --- |
| `api` | Backend route processing through response construction, before request logging |
| `authentication` | Route identity verification, session validation and permission check, including failed checks |
| `handler` | Endpoint handler work; public login/refresh work is included here |
| `pool` | Acquiring a database client, including queueing and any connection setup |
| `transaction` | Database transaction lifetime including acquisition, commit/rollback and release |
| `session_store` | Auth-store transaction lifetime; includes store operations beyond session reads |
| `authorized` | Repository authorization and business work within its authorized transaction |
| `db_control` | BEGIN, timeout configuration, COMMIT and ROLLBACK commands |
| `db_lock` | Statements containing account-lock acquisition or FOR UPDATE/FOR SHARE |
| `db_auth` | Other SQL outside the business callback, including provider liveness and activity updates |
| `db_business` | Other SQL inside the authorized business callback |
| `upstream` | Gateway fetch through complete upstream body receipt, including transport and backend processing |
| `gateway` | Complete gateway processing before diagnostic logging and response delivery |

Metrics are nested and overlap: **do not add them all together**. Each backend log
also includes a count for every recorded metric, so repeated authorization and
SQL command counts can be distinguished from one slow query. Timings accumulate
within one request using AsyncLocalStorage; concurrent requests do not share totals.
No tracing queries are added. Query text is classified locally and never emitted
in application telemetry. The isolated SQL audit still records parameterized SQL
templates as it did before; it never records parameter values.

`api.request.completed` retains request ID, static route, method, status, total
duration, existing actor-ID field and safe error code. Use the browser's
`X-Request-ID` to correlate it with `api.proxy.completed`. Natural 401s retain
`UNAUTHENTICATED`, `SESSION_EXPIRED` or `INVALID_CREDENTIALS` attribution without
logging access/refresh tokens, browser bindings, email, bodies or raw errors.
Gateway failures preserve their existing safe failure event and get timing too.
Timing/logging code does not retry requests.

## Deployment and connection diagnostics

Backend request logs include:

- `deployment.firstRequest`: first route invocation observed by this module in
  this process. This is a process-freshness hint, **not a measured platform cold start**;
  health checks may consume it before user traffic.
- `deployment.serviceRegion`: optional `API_REGION`, otherwise `VERCEL_REGION`.
- `deployment.databaseRegion`: optional `DATABASE_REGION`.
- `connections.firstSeen` / `reused`: acquisitions of client objects first observed
  by the instrumentation versus objects acquired previously in this process.
- `connections.waitingMax`: maximum pool queue length sampled just before a
  request's acquisitions, when the pool exposes `waitingCount`.

Set region labels from verified hosting/provider configuration, using only letters,
digits and hyphens (40 characters maximum). Missing/invalid labels are `unknown`.
Do not infer database placement from a hostname or public edge header. These labels
are log-only; credentials and database connection strings are never inspected for them.

`pool` cannot separate queue time from DNS/TLS/connection establishment.
First-seen client observations do not establish physical TCP connection reuse
through an external pooler. `db_lock` includes statement execution and the network
round trip; it is **not an exact lock-wait measurement**. To establish PostgreSQL
wait causes, correlate the request window with provider connection/pool metrics
and privileged database diagnostics (`pg_stat_activity.wait_event_type/wait_event`,
`pg_blocking_pids`, and statement statistics). Use a restricted operator connection;
do not grant these capabilities to the runtime role or add queries to each request.
This repository has not captured production waits or verified region placement.

## Browser comparison collector

`tests/performance-audit.mjs` continues to drive real login, navigation, protected
reads, focus checks and controlled missing-access recovery in isolated Chrome.
Supply test credentials as JSON on stdin using the existing in-memory mechanism.
It now records:

- Shell-ready and complete-initial-API times separately.
- Checking-screen visibility intervals emitted to the collector outside the
  document, closed on pagehide or disappearance. Reloading no longer erases the
  previous document's interval. This measures DOM visibility, not compositor paint.
- Document, API-request and session-read counts per navigation; request timing
  headers and safe response request IDs.
- Failed transport requests and safe 401 codes. Only denied API response bodies
  are parsed in memory, only the three approved error codes are retained, and no
  response bodies are persisted. An unreadable body produces `unknown`.
- Main-thread long-task count, total duration and maximum duration before the
  shell is ready, when Chrome supports that observer. These are not Core Web Vitals.

Defaults are 30 samples per sequential endpoint, warm navigation and recovery
scenario. `PERF_SAMPLES`, `PERF_NAV_SAMPLES` and `PERF_RECOVERY_SAMPLES` independently
adjust these counts (1–1000). `PERF_NAV_ONLY=true` skips sequential/concurrent/focus
checks. Label induced missing-access 401s separately from normal navigation and
focus failures when diagnosing the user's spontaneous recovery symptom.

`PERF_URL` selects the deployment. Timestamped reports preserve the original live
baseline; `PERF_OUTPUT` overrides the destination. SQL sensitivity runs likewise
write timestamped reports (`PERF_SQL_OUTPUT` overrides the path). Do not treat local
or simulated timings as evidence of production speed improvement.

## Local verification and deployment handoff

Completed under Node 22.14.0:

| Check | Result |
| --- | --- |
| Typecheck | Passed for frontend, contracts and API |
| Full automated suite | Passed: 70 backend and 19 frontend tests |
| Frontend production build | Passed |
| API production build | Passed |
| Headless Chrome smoke | Passed, including long-task observation and cross-document recovery timing in the two-tab refresh flow |
| Actual SQL audit | Passed: 45 measured cases, exact command-count attribution and revoked-session denial |
| Production gateway with local Postman simulation | Passed: 200/401/503 preserved, timings present, no extra upstream calls |

Use Node 22.14.0. Run `npm run typecheck`, `npm test`, `npm run build`,
`npm run build:api`, and `npm run test:browser`. The browser smoke additionally
checks real long-task observation and recovery timing across document reloads.

Run `node --import tsx tests/session-sql-audit.ts` for actual repository SQL and
timing-command count assertions against PGlite. The 45 measured cases still use
10 commands for session reads, 11 with activity updates and 22 for authentication
plus company list; revoked sessions still fail. This increment adds attribution,
not SQL optimization. The new local evidence is
[sql-timing-1793017848290.json](performance/sql-timing-1793017848290.json).

For the changed gateway's actual HTTP path:

```powershell
postman simulation run postman/simulations/session-audit.sim.yaml --port 4510 --output ndjson --no-history
# Separate terminal:
node --import tsx tests/gateway-timing-audit.ts
```

The production gateway was run against that local Postman member for successful,
expired and unavailable session reads. Each scenario preserved status/error
behavior, returned gateway/upstream timings, and made exactly one upstream request.
The CLI trace confirmed the sole member received all three requests. See
[gateway-timing-local.json](performance/gateway-timing-local.json). No real auth
provider or database participated in this simulation. Stop the simulation after use.

Before Phase 2 acceptance: deploy this increment to a preview with the existing
database and environment, capture both roles with the collector, correlate slow
requests with backend logs, and obtain real PostgreSQL wait evidence. Confirm
deployment commit parity and actual region labels. Repeat equivalent scenarios
after optimization; require the plan's latency and success-rate gates before
promotion. No preview/production deployment or live account test was performed in
this implementation run.
