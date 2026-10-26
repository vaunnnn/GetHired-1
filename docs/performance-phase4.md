# Phase 4: data loading and write overhead

Implemented locally on 2026-10-26, following
[the performance plan](performance-implementation-plan.md). Deployment and live
latency/error-rate comparisons remain pending.

## Company loading and bookmarks

Company pages load immediately on initial mount, page/filter changes and explicit
refresh. Only edits to the text search receive the 180 ms debounce. Query changes
reset pagination to page one, including clearing a search after leaving page two.
Existing rows remain while loading, and superseded responses cannot replace newer
results. The hook ignores old requests rather than promising server-side cancellation.

`GET /api/companies` and `/api/companies/:companyId` now return `CompanyListing`,
which adds a required read-only `bookmarked` boolean to the company projection.
It is an indexed EXISTS lookup for the authenticated account and visible company,
inside the existing authorized transaction. It accepts no owner override and adds
no SQL protocol round trip. These responses remain `private, no-store`.

Company inputs, admin company projections and bookmark payloads retain their
existing shapes. `bookmarked` cannot be submitted as a company write field.
The shared type, OpenAPI company-read operations and Postman assertion describe
the new projection. Backend tests verify two owners, off-page saves, private
detail state and mass-assignment rejection.

Home loads one paginated bookmark page. Explore uses the flags on its visible
company rows and no longer walks every full bookmark/company page to collect IDs.
The detail modal uses the fresh detail projection too. Confirmed local bookmark
changes update the displayed state while refetching; accepted server snapshots
replace temporary overrides. Detail reads overlapping a local save discard that
older snapshot and can retry the read once. Mutations themselves never replay.

Home bookmark reads pause outside Home. Partner counts are not reloaded after
bookmark-only writes. Explicit refresh invalidates both the affected bookmark/list
state and counts. An unknown/missing bookmark flag fails closed in Explore/details
instead of presenting an existing save as unsaved during a version mismatch.

## Tab reuse and invalidation

Successful company pages and category/question reads are reused for up to
30 seconds on tab revisits. Company cache keys include path, query, page and explicit
revision/retry. State belongs to the mounted workspace, whose provider is keyed by
the authenticated account and role. Logout, denial or account/role replacement
unmounts these private views; nothing is persisted or shared between users.
These are local component caches, not shared HTTP/session caches.

Admin categories load only on the Interviews tab; questions load only for the
opened category there. Successful reads survive quick tab revisits, while writes
increment the bank revision and invalidate cached categories/questions. Hidden
company/bank tabs do not refetch until opened. Student category lists are reused
briefly between Interview visits without caching server-selected question pipelines
or changing the existing interview-progress reset on leaving that view.

Expiry is checked when a view reopens or its request key changes. There is no
background data-polling promise; explicit refresh/retry remains available. Private
API authorization still runs for each actual request, independently of displayed
snapshots and Phase 3 session freshness.

## CSRF reuse and write coordination

Business mutations use a **shared** `gethired-auth` browser lock. Login, logout,
refresh and every generic `/api/auth/*` mutation retain an **exclusive** lock.
This includes password recovery completion, which can clear browser credentials.
The exclusive writer waits for active business requests; shared writes can overlap.
Backend authorization, activity updates, pool limits and database row locks are
unchanged, so same-session database work can still serialize.

Business CSRF values stay in memory for at most 60 seconds. Reuse requires the
same local auth epoch and cross-tab binding-generation marker. The marker in
`gethired-csrf-generation` is random invalidation metadata: it contains no CSRF
token, identity or authorization. Only server-verified credentials/CSRF grant access.
Auth changes/notifications, request failures and cookie-changing operations discard
the token. Cookie-changing writers update the marker while holding the exclusive
lock, including uncertain/failing outcomes, and notify other tabs.

Anonymous CSRF/binding initialization runs exclusively before shared requests.
The marker is checked again after acquiring the shared lock, covering a login/logout
that ran while the caller waited. If storage is blocked or read-only, the client
uses the conservative exclusive lock with fresh CSRF for each mutation. If the
marker repeatedly changes, initialization stops after three attempts with a
retryable local session-change error. No HTTP mutation is sent on those attempts.

Once an HTTP write is sent, transport errors, uncertain responses and CSRF failures
are surfaced without replay. Server origin, signed-binding and CSRF enforcement
remain unchanged. Expired, stale or tampered hints cannot authorize a write;
server rejection clears the memory token and requires an explicit new user action.
Auth operations continue fetching fresh CSRF, including the post-login fetch.
Refresh still does not rotate the signed browser binding.

## Local verification

Node 22.14.0:

| Check | Result |
| --- | --- |
| Automated suite | 77 backend + 34 frontend tests, 111 total |
| Typecheck and production builds | Frontend/contracts/API checks passed |
| Production Next.js + Chrome smoke | Initial/page/filter/refresh have no debounce; text search does; rows survive held requests; stale response ignored; page reset; off-page bookmark flag; detail save/unsave; one Home bookmark read; lazy bank and tab reuse; existing two-role/two-tab session/business scenarios |
| Production client over Postman HTTP | Three concurrent writes use 4 requests (one CSRF + three writes), down from 6; write start times overlap the fixture's 75 ms delay |
| Native Chrome mutation audit | Five checks passed with actual browser locks, shared cookies, HttpOnly bindings and the production gateway over the Postman member |

The native audit verifies anonymous binding issuance across two tabs, three
overlapping writes, exclusive logout/login waiting, generation invalidation without
depending on a delivered notification, failed/uncertain writes occurring once, and
blocked-storage fallback. Maximum active writes was three; auth/write overlaps
were zero. Its fixture pairs cookie/token values; it does not replace the backend's
signed-CSRF, JWT or database tests.

Evidence: [phase4-network-audit.json](performance/phase4-network-audit.json) and
[phase4-browser-mutations.json](performance/phase4-browser-mutations.json).
Earlier phase reports remain separate. Simulation measurements establish client
sequencing, not live database latency, production percentiles or capacity.

Reproduce after installing development dependencies and building contracts:

```powershell
npm run build
npm test
npm run typecheck
npm run build:api
npm run test:browser

# Separate terminal, local fixture only:
postman simulation run postman/simulations/session-audit.sim.yaml --port 4510 --output ndjson --no-history
# Run these sequentially; they reset the same simulation state:
node --import tsx tests/session-network-audit.ts
node --import tsx tests/mutation-browser-audit.mjs
# Stop the simulation after use.
```

The mutation harness bundles the actual client with the existing esbuild dependency,
serves it locally through the production gateway and launches isolated Chrome tabs.
No live credentials, provider state or hosted resources are used.

## Rollout and remaining acceptance

Deploy the backend read-projection addition before the frontend. Previous clients
ignore the additive field; the new Explore/detail UI requires it. Phase 4 needs no
new database migration; Phase 2's migration/readiness requirements remain in force.

Validate a preview with both roles, large bookmark sets, tab changes, concurrent
mutations and auth transitions. Use Phase 1 request IDs and pool/query timings to
separate browser improvements from backend serialization. Phase 5 placement,
controlled staging load, live success rates and at least 30-sample latency/p95
comparisons remain pending. Nothing was deployed by this implementation run.
