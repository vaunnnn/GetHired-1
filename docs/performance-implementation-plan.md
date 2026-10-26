# GetHired performance audit and implementation plan

Date: 2026-10-26. Target: https://gethired-1.vercel.app.

Implementation status (2026-10-26): Phase 1 instrumentation is implemented locally.
See [performance-observability.md](performance-observability.md) for metric
definitions, local verification and the deployment comparison handoff. Production
attribution/region/wait measurements and before/after comparisons remain pending.
Phase 2 is also implemented locally: see [performance-phase2.md](performance-phase2.md)
for the 4/5/6 SQL-call counts, real PostgreSQL concurrency evidence and required
migration/deployment order. Phase 3 is implemented locally: see
[performance-phase3.md](performance-phase3.md) for the refresh contract, recovery
without document reload, freshness/invalidation policy and verification.
Phase 4 is implemented locally: see [performance-phase4.md](performance-phase4.md)
for company/bookmark projection, loading/cache policy, shared-lock writes and
native browser/Postman verification. Phase 5 release tooling and rollout checks
are prepared locally: see [performance-phase5.md](performance-phase5.md). Hosted
placement, preview comparison and incremental deployment remain pending; the
user confirmed on 2026-10-27 that only the live URL is available. The audit and
original live baseline below are retained.

## Outcome

The deployed application is slow even with a valid session. Session reads take about **2.2 seconds**, company lists about **4.3 seconds**, and deliberately triggered session recovery about **10 seconds**. Complete initial page-data requests take about **8.0 seconds for admin and 9.8 seconds for student**. Repeated database round trips, duplicate authorization transactions, request serialization, and the recovery request chain are confirmed optimization targets.

No application behavior was changed in this audit. The added files are diagnostic scripts, isolated Postman fixtures, sanitized measurements, and this plan. Live tests used the supplied test accounts; no companies, students, questions, passwords, or account settings were edited. Each completed browser run logged out its own test session.

## Method and evidence

- Headless Chrome against the actual HTTPS deployment, without network throttling. Actual login forms, cookies, the Next.js gateway, backend, auth provider, and database participated.
- Both admin and student: one login, five warm protected-page navigations, ten sequential reads per endpoint, three batches of four concurrent session reads, three focus events, and three recovery navigations.
- Recovery was induced by deleting only the isolated browser's access cookie while retaining its refresh and browser-binding cookies. This exercises the real recovery path without changing provider expiry or revoking another device. It reproduces recovery cost, not the cause of spontaneous expiry.
- A supplemental navigation run waits for initial API requests to finish, distinguishing an interactive workspace shell from completed data requests. Its results are stored separately.
- Actual auth-store and company-repository SQL executed against PGlite with repository migrations and the restricted runtime role. Statement counts were asserted. Added per-query delays are explicitly sensitivity experiments, not production timings.
- The real API client ran over HTTP against a local Postman simulation with 75 ms injected per request. This confirms request sequencing and mutation serialization; it does not measure Supabase latency or enforce real authentication.

Evidence:

| File | Contents |
| --- | --- |
| [performance/live-audit.json](performance/live-audit.json) | Live endpoint samples, browser timings, recovery waterfalls and concurrency results |
| [performance/live-navigation-audit.json](performance/live-navigation-audit.json) | Supplemental navigation measurements with complete initial API traffic |
| [performance/sql-audit.json](performance/sql-audit.json) | Actual SQL statements, counts and latency sensitivity samples |
| [performance/network-audit.json](performance/network-audit.json) | Production client request chains against the Postman simulation |

The main live run used the installed Node 24 process to drive Chrome; the supplemental run and local verification used the project's supported Node 22.14.0. Chrome executes the frontend in both cases. Live endpoint timings are browser fetch-to-body-completion times. Navigation times include polling overhead and are not Lighthouse or Core Web Vitals measurements. The main run's navigation traffic snapshots can omit requests still pending after the shell appeared; use the supplemental run for complete initial request counts. Its `initialApiCompleteMs` measures API response completion, not paint timing.

Only ten sequential samples were collected per role and endpoint. The empirical p95 is the maximum of those ten samples, not a production percentile or capacity estimate. No high-concurrency load test was performed.

One supplemental collection attempt completed the admin scenarios but timed out waiting for outstanding API responses after switching accounts. Its partial output is retained in `performance/live-navigation-admin-audit.json`. Student navigation was collected in a fresh isolated browser; the combined supplemental report identifies its source files. This collector timeout is not counted as a measured application outage.

## Live measurements

| Operation | Samples per role | Admin median | Admin p95 | Student median | Student p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| GET /api/auth/csrf | 10 | 506 ms | 623 ms | 464 ms | 588 ms |
| GET /api/auth/me | 10 | 2,226 ms | 2,360 ms | 2,211 ms | 3,830 ms |
| GET company list | 10 | 4,349 ms | 4,754 ms | 4,305 ms | 4,957 ms |
| Warm navigation to interactive shell | 5 | 3,703 ms | 4,373 ms | 5,427 ms | 5,464 ms |
| Missing-access recovery to interactive shell | 3 | 9,870 ms | 9,981 ms | 10,224 ms | 11,439 ms |

Company-list paths were `/api/admin/companies?page=1&pageSize=20` and `/api/companies?page=1&pageSize=20`. Every measured sequential read returned 200. Login-to-interactive-shell took 14,917 ms for admin and 11,401 ms for student; these are single observations, not representative login percentiles.

The supplemental run waited for outstanding API requests between navigations, avoiding interference from the previous page's unfinished requests:

| Supplemental scenario | Admin | Student |
| --- | ---: | ---: |
| Warm shell-ready median, three navigations | 2,313 ms | 2,302 ms |
| Warm initial-API-completion median, three navigations | 7,974 ms | 9,756 ms |
| Recovery shell ready, one navigation | 9,678 ms | 8,956 ms |
| Recovery initial APIs complete, one navigation | 15,702 ms | 16,634 ms |

All three admin warm navigations made a mount-time session check plus category and company-list requests. All three student warm navigations made a session check, two differently paginated bookmark reads and a company-count/list read. These are browser-visible calls; the document's server-side session check adds another upstream authorization request. The slower shell timings in the main run include interference from unfinished data loads; use the supplemental values for a fully settled navigation baseline.

Four simultaneous `/auth/me` requests finished in approximately these ordered groups:

- Admin: 2.23–2.25 s, 2.94–2.97 s, 3.64–3.67 s, 4.34–4.37 s.
- Student: 2.18–2.19 s, 2.87–2.89 s, 3.58–3.60 s, 4.28–4.29 s.

The staircase repeats in all three batches for each role. It establishes that these requests do not complete independently. The exclusive session-row lock in the source is consistent with this behavior; production SQL tracing is still needed to separate lock waiting from pool waiting and execution time.

All six focus-event checks issued another `/auth/me` request, taking approximately 2.17–2.36 s. None made the workspace inert or displayed a status overlay at the inspection point. This confirms that routine revalidation in the current deployment is not the reproduced full-page blocker.

Observed public response region labels were `sin1`. This identifies the public serving region, **not** the backend execution region or database region. Region mismatch, cold starts and database connection setup have not been established as root causes.

## Confirmed findings

### 1. Session validation is expensive before any business data is read

`apps/api/src/auth/service.ts:authenticate` calls `store.withSession`. `apps/api/src/auth/store.ts:withSession` performs ten sequential database commands on the successful read path:

1. BEGIN.
2. Set transaction lock timeout.
3. Set transaction statement timeout.
4. Lock the account for shared access.
5. Read account and student profile.
6. Read the session FOR UPDATE.
7. Read database time after acquiring locks.
8. Check provider-session liveness.
9. Check provider-session liveness again after the callback.
10. COMMIT.

The account lock is shared in this path; the session row lock is exclusive. `provider_session_live` is a SQL function reading provider tables, not a separate HTTP call to Supabase Auth. The audit confirmed ten statements for normal validation and eleven when updating activity.

### 2. Company reads validate authorization twice

`apps/api/src/api/route.ts` authenticates first. `apps/api/src/modules/companies/repository.ts:list` then enters `authorizedTransaction`, repeating account/session/provider checks and updating activity before returning data.

The isolated database audit executed the actual empty company-list path and asserted **22 sequential SQL commands across two transactions**. That includes only one list-data query. This also explains why optimizing React rendering alone will not fix the measured 4.3-second list response.

Sensitivity experiment, five samples per cell:

| Actual code path | SQL commands | No injected delay, median | +25 ms per command, median | +75 ms per command, median |
| --- | ---: | ---: | ---: | ---: |
| Session validation | 10 | 5 ms | 310 ms | 778 ms |
| Validation with activity update | 11 | 4 ms | 344 ms | 868 ms |
| Authentication plus company list | 22 | 8 ms | 685 ms | 1,731 ms |

PGlite is local and single-connection. These results demonstrate sensitivity to sequential round trips; they do not prove production per-query latency or PostgreSQL lock contention. Timer overhead means injected-delay results need not equal command count multiplied by the requested delay.

### 3. Recovery repeats verification and reloads the document

One live admin recovery waterfall:

| Request | Status | Duration |
| --- | ---: | ---: |
| Initial /admin document with missing access cookie | 200 recovery page | 553 ms |
| GET /api/auth/me | 401 | 494 ms |
| GET /api/auth/csrf | 200 | 504 ms |
| POST /api/auth/refresh | 200 | 3,197 ms |
| GET /api/auth/csrf | 200 | 469 ms |
| GET /api/auth/me | 200 | 2,238 ms |
| Reload /admin document, including server-side verification | 200 | 2,272 ms |

`SessionRecovery.tsx` awaits `apiClient.refresh()` and calls `window.location.replace(path)`. The refreshed document verifies again; `SessionProvider.tsx` also starts a mount-time verification. These verified steps add up before useful work can resume.

The five requests inside `refresh()` were independently asserted over real HTTP. Calling `me()` with expired access makes **seven** requests: the initial failing read, those five recovery requests, and a final repeated read. A generic protected read still needs to retry its original data request, but `/auth/me` need not discard and fetch the recovered user again.

### 4. Writes pay for CSRF retrieval and share one browser lock

`api-client.ts:mutate` holds the `gethired-auth` lock around both a fresh CSRF request and the mutation. Three concurrent mutation calls therefore made six serial HTTP requests. With a controlled 75 ms delay per request, they took 495 ms in the simulation. No live business mutation was used for this experiment.

The post-refresh CSRF retrieval is also unused. In the current backend, refresh sets credentials but does not rotate the browser binding. Login does rotate the binding, so changes to token reuse must distinguish login from refresh and handle cross-tab changes.

### 5. There is avoidable client request work

- `SessionProvider.tsx` checks immediately after receiving an already validated server session, on focus/pageshow/visibility events and every minute. In-flight checks are coalesced, but completed checks have no freshness interval.
- `Dashboard.tsx` loads a bookmark page and separately walks all bookmark pages to obtain saved IDs. The latter downloads full bookmark/company payloads for an ID-only use case. Both bookmark requests occurred in every supplemental student navigation.
- `AdminDashboard.tsx` loads categories immediately even while the companies tab is active. This occurred in every supplemental admin navigation.
- `CompanyResults.tsx` delays every load by 180 ms, including initial loads, pagination and explicit refresh. It also empties existing rows while refetching. This is source-confirmed overhead; the audit did not separately time its contribution to perceived latency.

## Implementation order

### Phase 1 — Add timing attribution and establish comparison metrics

Files: `apps/api/src/api/route.ts`, `apps/api/src/db/transaction.ts`, `apps/api/src/auth/store.ts`, `src/server/proxy/handler.ts`, diagnostic scripts.

1. Record named durations for gateway/upstream, pool acquisition, authentication, authorized transaction and business query. Propagate safe Server-Timing metrics where appropriate; do not expose SQL, tokens or identities.
2. Retain the existing request ID and total duration logging. Make backend logs sufficient to correlate one slow browser request with its database work.
3. Record cold/warm status, configured service/database regions, connection reuse and pool/lock waits through deployment diagnostics. The public `sin1` header alone is insufficient.
4. Extend browser diagnostics to separately track shell readiness, complete initial data, recovery-screen duration across document changes, request counts and main-thread long tasks. The audit's final-document `checking` fields reset on reload and do not measure the previous recovery screen's visible duration.
5. Capture natural 401 error codes and timing to investigate why this user's normal navigation enters recovery. Do not log credentials or change provider expiry settings to conceal the symptom.

Acceptance: each slow protected request can be attributed to authentication, connection/lock waiting, business execution or transport. Reproduce this audit against the same deployment before and after changes.

### Phase 2 — Reduce SQL round trips and repeated authorization

Files: `apps/api/src/auth/store.ts`, `apps/api/src/db/transaction.ts`, `apps/api/src/api/route.ts`, company/interview/onboarding repositories, migrations as needed.

1. Implement one reviewed authorization primitive that obtains the account and session state, validates identity/role/status/credential barriers/provider liveness, and checks expiry using database time after locks are acquired.
2. Reduce protocol round trips by consolidating compatible operations into a database function or fewer statements. Avoid simply removing checks to reduce the count.
3. Allow business routes to authorize and execute within the same transaction rather than authenticating fully and then doing the same transaction again. Keep the route's explicit permission declaration and the repository's ownership checks; make transaction ownership explicit.
4. Give read-only session polling an appropriate read strategy instead of unnecessarily taking an exclusive session lock. Evaluate shared locks or a consistent database authorization function. Maintain account-before-session lock order and atomic revocation/deactivation guarantees.
5. Preserve the exclusive refresh lock and refresh-replay handling. Keep a post-provider-call liveness/expiry check when external work can outlive the original validation. Ordinary session projection has no such external callback and should not automatically pay for the same generic path.
6. Preserve deliberate user-activity updates for business reads/writes while ensuring background polls and refresh never extend idle life. Consolidate activity updates within the existing authorized transaction.

Acceptance: company reads no longer run two complete authorization transactions; a session read uses at least 50% fewer SQL protocol round trips. Run deactivation, role-change, provider logout, password reset, revocation, idle/absolute expiry and concurrent refresh regressions. Verify actual PostgreSQL concurrency before relaxing lock behavior; PGlite cannot establish that guarantee.

### Phase 3 — Shorten recovery and revalidation

Files: `src/lib/api-client.ts`, `src/components/SessionRecovery.tsx`, `SessionProvider.tsx`, `ProtectedPage.tsx`, `apps/api/src/auth/service.ts`, contracts and auth tests.

1. Let refresh return the safe current-user projection in addition to session information. Update the contract and preserve existing consumers. Reuse that verified result rather than requesting `/auth/me` again solely for a projection.
2. Remove the unused post-refresh CSRF GET once its binding invariants are covered by tests.
3. Special-case session reads to use the recovered CurrentUser rather than performing a seventh request. Keep retry of the original endpoint for unrelated protected reads.
4. Preserve cross-tab coordination and the under-lock recheck that prevents duplicate refresh-token rotation. Eliminate redundant calls only where the caller can safely reuse an authoritative result.
5. Replace the recovery document reload with mounting the role-validated client workspace from the recovered session, or a reviewed cookie-writing server boundary. Never expose a protected workspace before successful verification. Server-rendered session reads must remain GET-only unless a response boundary can deliver Set-Cookie to the browser.
6. Treat the server-provided session as freshly checked on mount. Coalesce focus/pageshow/visibility triggers and add a short successful-validation freshness interval. Invalidate freshness after login/logout, account change or session denial; API authorization still runs on every protected request.
7. Keep a usable authenticated workspace during routine background checks. Handle transient service failures without turning them into expired-session redirects, and block access promptly after confirmed revocation.

Acceptance: valid-session navigation adds no immediate duplicate mount-time `/auth/me` request; focus bursts cause at most one revalidation within the chosen freshness interval; recovery avoids a full document reload and redundant projection requests. Verify both roles, multiple tabs, real expiry, refresh replay, logout during refresh and provider outages.

### Phase 4 — Reduce data-loading and write overhead

Files: `src/components/CompanyResults.tsx`, `Dashboard.tsx`, `AdminDashboard.tsx`, `src/lib/api-client.ts`, bookmark contract/repository if needed.

1. Apply the 180 ms debounce only to text-search edits. Load initial data, page changes and explicit refresh immediately. Retain previous rows while refreshing and ignore/cancel superseded requests.
2. Deduplicate bookmark data requests. Prefer deriving IDs from already loaded data; if all IDs are required, add a bounded ID-only API instead of fetching every company's full details. Specify its pagination and private ownership contract.
3. Load categories/questions when their tab is opened, with explicit invalidation after writes.
4. Consider a small private client cache keyed by account, role, query and page. Clear it on logout/account change, and invalidate affected keys after mutations. Do not introduce shared caching of session or private responses.
5. Reuse CSRF values only while the signed browser binding is known to be current; invalidate on binding rotation and cross-tab auth notifications. Retain server CSRF enforcement.
6. Separate business-mutation concurrency from cookie-rotation serialization only after testing cookies, anonymous CSRF initialization and concurrent login/logout. Do not automatically replay writes after an uncertain response or CSRF failure.

Acceptance: initial loads have no debounce delay; switching tabs does not unnecessarily reload unchanged data; search does not blank the existing list; bookmark identity is correct off-page; mutations remain exactly once from the client's perspective and preserve cross-tab auth safety.

### Phase 5 — Validate hosting placement and deploy incrementally

1. Use Phase 1 measurements to establish frontend, API, auth provider and database placement. Co-locate API and database if cross-region latency is confirmed.
2. Inspect database connection reuse, the five-connection pool and wait times before changing pool limits. Increasing the pool alone does not fix same-session row serialization.
3. Compare a preview deployment with this live baseline, first for both roles and then for multiple simultaneous independent test users. Use controlled staging load tests, not stress tests against the live site.
4. Promote SQL/auth changes separately from client caching/concurrency changes so regressions can be attributed and rolled back.

Proposed performance gates, to validate rather than promise:

- At least 50% reduction in live median session-read and company-list duration, with no worse error rate.
- At least 50% reduction in median recovery-to-interactive time, with no full document reload in the client recovery design.
- No serial staircase for independent read-only session checks after the reviewed lock change.
- Zero full-page session-check overlays during successful routine revalidation.
- Track p95 with at least 30 samples per target scenario before release; keep successful read and recovery rates alongside latency.

## Verification completed

| Check | Result |
| --- | --- |
| Production Next.js build | Passed |
| `npm run typecheck` under Node 22.14.0 | Passed |
| `npm test` under Node 22.14.0 | Passed: 66 backend and 17 frontend tests; 83 total |
| `npm run test:browser` under Node 22.14.0 | Passed: existing B3/B4/B5/B6 browser smoke against isolated HTTP fixtures |
| `tests/session-sql-audit.ts` | Passed: 45 measured SQL runs, asserted statement counts and revoked-session rejection |
| `tests/session-network-audit.ts` | Passed: four actual-client HTTP scenarios, asserted request counts |
| Postman live liveness request | Passed: GET /api/health/live returned 200 in 758 ms; one assertion |
| Live browser audit | Passed: both roles; 60 sequential read samples, six concurrent batches, six focus checks and six recovery navigations |
| Supplemental settled-navigation audit | Completed three warm navigations and one recovery per role; initial data completion and duplicate/eager requests recorded. Earlier cross-account collector timeout retained separately. |

An initial test run under unsupported Node 24 failed with `ERR_INVALID_STATE: ReadableStream is already closed` in multipart/stream tests. The complete unchanged suite passed under Node 22.14.0. This is an environment compatibility finding, not evidence of the live performance root cause.

## Reproduce safely

Use Node 22. Do not commit credentials, cookie jars or raw authenticated request dumps. `tests/performance-audit.mjs` accepts an array of `{role, identifier, password}` objects from stdin; supply it through an in-memory pipe or a local secrets mechanism. `PERF_URL` selects the deployment. `PERF_NAV_ONLY=true` runs the supplemental complete-navigation audit. Chrome defaults to the standard Windows installation path; override `CHROME_PATH` if needed.

```powershell
npm run build
npm test
npm run test:browser
node --import tsx tests/session-sql-audit.ts

# Separate terminal; local fixture only, no workspace publish or account needed.
postman simulation run postman/simulations/session-audit.sim.yaml --port 4510 --output ndjson --no-history

# Run while the simulation is listening.
node --import tsx tests/session-network-audit.ts
```

The simulation trace was checked: its sole member served the production client's requests; no member was unused. The fixture comes from this repository's auth contract and browser smoke test, not a downloaded workspace mock. Stop the local simulation after use.

## Remaining uncertainties

- Why normal usage repeatedly loses or expires access credentials. The audit induced missing access and measured the resulting cost; it did not observe naturally recurring 401s during healthy-session reads.
- Production SQL timings, connection establishment, pool waits and lock waits; backend logs/database tracing were unavailable to this run.
- Exact deployment commit parity with this checkout. The live recovery waterfall matches the inspected client path, but no deployment commit identifier was available.
- Natural access-token expiry after provider TTL. Deleting the access cookie is a controlled recovery test, not a timed natural-expiry test.
- Large-data search cost, sustained multi-user capacity, mobile hardware, low-bandwidth networks and browser main-thread work. These were outside this audit and must not be inferred from the measurements above.
