# Phase 5: placement verification and incremental release

2026-10-29 clarification: the user now confirms `https://gethired-1.vercel.app`
and its backing services are isolated staging. This supersedes the target
classification uncertainty in the historical 2026-10-27 notes below. Hosted
interview HTTP acceptance has passed, and a separate disposable local PostgreSQL
interview concurrency/load audit is recorded in
[interview verification](interview-concurrency-verification.md). Neither proves
the broader Phase 5 performance release gates. The existing cohort runner's
known-host guard has not been changed or bypassed by that local audit.

Status, 2026-10-27: local release tools are prepared; hosted validation and
deployment are pending. The user confirmed only `https://gethired-1.vercel.app/`
is available, with no staging deployment or configured credential source. No
migration, region, pool limit or deployment was changed. Release is not accepted.

## Placement and access evidence

The current `vercel.json` deploys Next.js only. Commit `4c41fb4` removed the
Express service and retained the Render proxy. The [hosting guide](vercel-services.md)
and root environment example now distinguish the current separate-host setup
from the former Vercel service-binding configuration.

| Component     | Available evidence                                   | Required hosted verification                               |
| ------------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| Frontend      | Vercel live URL; response edge hint `sin1`           | Deployed commit and function region                        |
| API           | Historical B2 guide and commit describe Render       | Current upstream, service region, deployed commit and logs |
| Database      | Historical pooler hostname contains `ap-southeast-1` | Actual project region, endpoint mode and connection budget |
| Auth provider | Historical Supabase project                          | Current project, provider session schema/TTL and region    |

There is no local Vercel CLI/project link/auth file or database credential source;
the local frontend targets loopback. The historically documented staging frontend
returned 404 for both health paths and is not an available staging target.

[phase5-preflight.json](performance/phase5-preflight.json) records four public
health GETs only. Live liveness timed out at 20 seconds; readiness returned 200 in
about 19.6 seconds. Neither supplied `Server-Timing`. These isolated probes do
not establish percentiles, cold starts, placement, parity or the bottleneck.
No authenticated or load requests were sent in Phase 5.

Confirm actual hosting settings and measure API→database/provider paths from the
API host before attempting co-location. The public edge header and a pooler
hostname alone do not confirm cross-region latency.

## Connection reuse and waits

Keep the maximum of five connections per API process. Budget all API instances,
overlapping releases, maintenance and provider connections together.

Pipe plain API `api.request.completed` NDJSON from a private log source into:

```powershell
node tests/performance-telemetry.mjs docs/performance/preview-pool-UNIQUE.json
```

The command reads stdin and emits aggregate protected-read timing distributions,
connection reuse/first-seen counts, maximum observed pool queue, errors and region
labels. It discards actors, request IDs and arbitrary fields. Keep raw logs outside
the repository. Output refuses overwrite; invalid NDJSON or no matching reads
returns exit 1. Convert dashboard wrapper formats to plain NDJSON first.

Compare process-first and reused-connection requests, pool acquisition,
transaction and authorization durations. First-seen is process-local; pool time
includes connection acquisition/establishment. Region labels require operator
confirmation. Authorization time does not isolate provider RTT; SQL duration
does not prove lock waiting. Correlate private request IDs with PostgreSQL wait
events separately. Existing [PostgreSQL checks](performance-phase2.md) prove
local lock behavior only. No pool increase is justified without hosted evidence.

## Measurement order

Use Node 22.14.0. Supply account arrays `{role, identifier, password}` through
stdin from a local secret mechanism; never commit account files, cookie jars or
raw authenticated dumps. Each completed browser worker logs out its test session.
Interrupted workers may leave test sessions requiring operator cleanup.

1. Re-measure live sequentially for both roles using `tests/performance-audit.mjs`.
   Set `PERF_SAMPLES`, `PERF_NAV_SAMPLES` and `PERF_RECOVERY_SAMPLES` to `30`,
   `PERF_URL` to the live origin and `PERF_OUTPUT` to a new timestamped path.
   This bounded sequential audit is separate from multi-user load. The retained
   baseline has only 10 reads and three recoveries per role and cannot satisfy
   the proposed 30-sample release minimum.
2. Configure an isolated preview API/database with synthetic test accounts, exact
   `APP_ORIGIN`, gateway secrets and ingress verification. A preview frontend
   pointing to the live API is not isolated staging. Run the same sequential
   two-role audit, preserving failures and recording commit/schema/data parity.
3. Compare raw observations:

```powershell
node tests/performance-release.mjs BASELINE.json PREVIEW.json docs/performance/comparison-UNIQUE.json
```

Each input is an audit or array of audits. The comparator recalculates median/p95
from successful raw samples and retains attempts, failures and success rates.
Each role needs 30 successful samples for session reads, company lists and
recovery. It requires 50% median improvement, no worse success rate, one document
per recovery, and measured zero routine checking-overlay duration. Missing data,
failed audits and undersized baselines cannot pass. Exit 1 means unsatisfied
gates. Numerical success alone does not approve promotion. Compare equivalent
conditions; do not merge different releases or single-user and cohort samples.

4. Review sequential results before a bounded independent-user staging cohort:

```powershell
$env:PERF_TARGET_ENVIRONMENT = "staging"
# Pipe secret account JSON to this command; do not supply secrets as arguments.
node tests/performance-staging.mjs https://STAGING-ORIGIN docs/performance/cohort-UNIQUE
```

The runner launches 2–4 independent Chrome workers concurrently, requires both
roles and distinct identifiers, and fixes each scenario at 30 samples per user.
It rejects the known live hostname and requires the staging label. That label
cannot verify isolation: confirm API/database separation, including alternate
hostnames aliasing live. It exercises reads/navigation/focus and controlled
missing-access recovery; login/refresh/logout modify only test sessions. It does
not edit business records or explore maximum capacity. It retains per-worker
failures and a cohort manifest; `reports.json` can be compared separately.
Browser CPU/network contention may influence cohort results.

Review four-read batches and hosted SQL traces for overlap and absence of the
serial staircase; batch timings alone cannot prove database concurrency.
Routine-focus checks now measure checking-overlay intervals throughout the
observation window as well as the final DOM state. Missing-access recovery does
not validate natural provider TTL; observe that separately before promotion.

These tools follow the Postman API engineering/performance guidance: reuse the
existing contract/audit, bound concurrency and effects before load, distinguish
runner limits and retain errors alongside latency. No Postman cloud load or
workspace publication is needed for the existing browser scenarios.

## Incremental promotion and rollback

All Phase 1–4 work remains uncommitted together. Do not deploy this whole working
tree as a SQL/auth-only release or blindly select whole files: some contain
multiple phases. Prepare reviewed release commits with the following boundaries,
and build/test each exact artifact before deployment:

| Stage             | Contents and acceptance                                                                                                                                            | Rollback                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Instrumentation   | Phase 1 backend/gateway timings; collect placement/pool baseline                                                                                                   | Previous backend/gateway artifact                                                            |
| Database          | Operator applies additive `202610260001_session_authorization.sql` after existing migrations; verify invoker grants/provider compatibility                         | Retain additive function/marker during application rollback; never reset schema/session rows |
| Backend           | Phase 2 shared authorization/transaction reuse/readiness; additive Phase 3 refresh user and Phase 4 readonly bookmark projections; earlier frontend stays deployed | Previous backend while earlier frontend remains deployed; retain migration                   |
| Recovery UI       | Phase 3 user/revalidation/recovery after backend verification                                                                                                      | Earlier frontend with newer backend                                                          |
| Cache/concurrency | Phase 4 private caches, loading and CSRF shared-lock changes after earlier gates                                                                                   | Previous frontend with newer backend                                                         |

The new client requires the backend refresh-user and bookmark projections. Once
the new frontend is deployed, roll it back **before** a backend rollback that
omits those fields. If necessary, split SQL/auth and additive response fields
further, testing compatibility on each artifact.

For each stage retain deployed commit IDs, schema marker, previous artifact,
configuration changes, logs, both-role latency/errors and rollback evidence.
Verify ownership, deactivation/revocation/expiry, refresh replay, cookie/CSRF/IP
boundaries and readiness. Final promotion requires the full comparison, isolated
cohort, hosted placement/pool/wait evidence and revalidation/recovery invariants.

Local verification passed under Node 22.14.0: typecheck and all 117 tests
(77 backend, 40 frontend/diagnostic), including six new release/telemetry/target
guard tests. These cover sample sufficiency, both roles, errors, partial audits,
recovery reloads, transient overlays, percentiles, sanitization and live-target
rejection. The independent-user runner has not been exercised against staging.
[Baseline readiness](performance/phase5-baseline-readiness.json) records the
existing undersized baseline with no preview evidence. Hosted acceptance remains
pending.
