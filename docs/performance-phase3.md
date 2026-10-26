# Phase 3: shorter recovery and session revalidation

Implemented and verified locally on 2026-10-26. This implements Phase 3 of
[the performance plan](performance-implementation-plan.md). Hosted deployment,
natural provider-token expiry and live latency comparisons remain pending.

## Recovery contract and request counts

`POST /api/auth/refresh` now returns `{ user, session }` in its existing success
envelope. Consumers reading `data.session` retain that field. The shared
`RefreshResult` type, OpenAPI schema, local Postman assertion and simulation/browser
fixtures describe the amended contract. The projection contains no tokens or
private provider/session rows and is returned only after the existing exclusive
refresh transaction and post-provider database authorization succeed.

Refresh still leaves the signed browser binding and idle activity unchanged.
Backend tests verify the safe user, only two credential cookies, unchanged binding,
pre-refresh CSRF validity and no idle extension. Login still rotates the binding
and retains its post-login CSRF fetch.

| Client path | Previous HTTP requests | Phase 3 |
| --- | ---: | ---: |
| Recovery requiring refresh | 5 | 3: under-lock me, CSRF GET, refresh POST |
| Me encountering expired access | 7 | 4: initial denial plus recovery |
| Another tab already refreshed | 1 | 1: successful under-lock me |

The client validates and reuses the returned user instead of fetching it again.
Other protected reads still retry their original endpoint after recovery. Writes
are never automatically replayed. Business mutation locks and per-write CSRF
retrieval remain unchanged; Phase 4 concurrency/cache work is separate.

`SessionRecovery` mounts `AuthenticatedWorkspace` from the verified result without
replacing the document. The client boundary checks the requested role before
mounting either dashboard/provider. A recovered student visiting `/admin` gets
access denied. No workspace children are serialized through the recovery branch.
Server-rendered verification remains GET-only and does not rotate credentials.
Initial service errors retain the recovery screen until the user retries; retry
can verify and mount the workspace in place.

## Freshness, invalidation and failures

The provider seeds a controller from the authoritative SSR/recovery result. A
successful check is fresh for **15 seconds**, bounded by projected absolute expiry.
Fresh mounts issue no duplicate me request. Focus/pageshow/visibility bursts skip
fresh checks and coalesce stale checks. The existing minute timer remains; hidden
tabs skip routine checks. Every protected API call still authorizes independently.
This is UI freshness, not an authorization cache or a promise to detect external
revocation within 15 seconds; polling, visibility and API responses determine that.

Login/logout and cross-tab auth notices invalidate freshness, including pending
checks. Notices carry only a change marker and opaque source ID, never user data or
credentials, and require an authoritative read. Legacy `"changed"` notices remain
understood. Refresh no longer emits an unnecessary auth-change notice: it cannot
switch accounts or rotate the binding, and waiting tabs still check shared cookies
under the auth lock.

Client epochs prevent a stale recovery from publishing after login/logout or an
auth-change notice. Changed-session results are discarded and revalidated, rather
than treated as evidence that the new account is denied. Logout queued during
refresh invalidates recovery, then revokes using the credentials current under the
lock. The `gethired-auth` browser lock and under-lock check still prevent duplicate
token rotation across tabs.

Transient revalidation errors show a retry banner without making the workspace
inert or redirecting. Confirmed session/refresh denial removes the workspace and
redirects promptly, including denial found during a business read's recovery.
Only explicit logout shows the pending sign-out overlay. Confirmed account/role
changes remove the old workspace and navigate through server verification, clearing
private component state. Unmounted controllers ignore pending results.

## Verification

Node 22.14.0:

| Check | Result |
| --- | --- |
| `npm test` | 77 backend and 29 frontend tests; 106 total passed |
| Typecheck, frontend/API production builds | Passed |
| Headless Chrome smoke | Passed: both roles, no mount-time me, fresh/stale focus bursts, nonblocking outage/retry, two-tab refresh/logout, no recovery document reload, recovered wrong-role denial and initial outage retry in place |
| Backend lifecycle regressions | Passed, retaining replay, revocation, idle/absolute expiry, provider failure, role change and credential-reset checks; added projection/binding/CSRF assertions |
| Client/controller regressions | Passed: exact chains, mutation replay rules, malformed projections, logout during refresh, stale pending results, freshness, account change, denial, retry and unmount |
| Real-client HTTP over local Postman simulation | Passed: refresh 3, expired me 4, three mutations 6 (unchanged), me outage 2 (unchanged) |

The sole Postman member received all 15 application requests (23 events including
control calls). No member was unused. The 75 ms per-request fixture delay describes
sequencing, not production latency. Sanitized evidence:
[phase3-network-audit.json](performance/phase3-network-audit.json).

Run `npm run build`, `npm test`, `npm run typecheck`, `npm run build:api`, and
`npm run test:browser`. For the existing local simulation:

```powershell
postman simulation run postman/simulations/session-audit.sim.yaml --port 4510 --output ndjson --no-history
# Separate terminal:
node --import tsx tests/session-network-audit.ts
# Stop the simulation after use.
```

The browser expiry cases use controlled denied-access responses. They do not
establish natural Supabase TTL behavior or provider-side replay timing. No live
credentials or hosted account state were changed.

## Rollout

Deploy the backend addition before the frontend. The new client requires the user
projection and fails closed if an older backend supplies only a session. Old
clients can continue reading the unchanged session field during rollout. Phase 3
needs no new database migration; Phase 2's migration/readiness marker remains
required for this checkout.

Validate a preview with both roles, multiple tabs, natural expiry, logout during
refresh and provider outages. Repeat the original live audit with cross-document
measurements and at least 30 samples per scenario. Median/p95 and success-rate
release gates remain unmeasured; local request reductions are not live latency claims.
