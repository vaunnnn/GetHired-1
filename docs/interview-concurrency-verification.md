# Interview concurrency and bounded load verification

Verified 2026-10-29 against disposable PostgreSQL 17.11, using the real application
repositories, authorization, migrations and a five-connection runtime pool.
The user confirmed that the hosted application is isolated staging. This audit
does not connect to it: local race tests deliberately hold locks and manipulate
evaluation lease timestamps in a generated test database.

## Results

[Final evidence](performance/interview-postgres-1793262113916.json) contains eight
passing correctness cases, nine observed lock races, raw successful flow timings,
operation distributions and cleanup confirmation. Each race observed five distinct
PostgreSQL backends with `wait_event_type = 'Lock'` before releasing the blocker.
The [earlier seven-case run](performance/interview-postgres-1793261851411.json)
is retained as preliminary evidence; the final run adds completion versus the
last answer submission. Do not combine these runs into one latency distribution.

- Concurrent starts return one unfinished attempt.
- Conflicting drafts accept one revision and reject four stale writes.
- Duplicate written submissions claim one evaluation and one budget unit.
- An expired lease has one replacement; stale evaluation results are rejected.
- Duplicate MCQ submissions return identical stored grades without regrading.
- Completion versus edits preserves an immutable score and rejects changes.
- Concurrent restarts abandon one attempt and create one replacement.
- Completion versus the last submission either rejects incomplete work or
  returns the correct completed result; it never stores a partial score.

Same-student races use five separate authenticated test sessions. Sharing one
session would serialize at the authorization lock and obscure attempt locking.
Load workers instead use separate synthetic student accounts.

| Workers | Completed flows | Errors | Flows/second | Flow p95 |
| --- | ---: | ---: | ---: | ---: |
| 1 | 30 | 0 | 4.89 | 255.4 ms |
| 2 | 60 | 0 | 12.35 | 190.7 ms |
| 5 | 150 | 0 | 33.98 | 173.8 ms |

Each worker executes 30 sequential full flows: start, draft save, written claim,
simulated provider work, settlement, MCQ submission, completion and retrieval.
The provider delay is fixed at 10 ms and no Gemini calls are made. The test
asserts the final score and persisted result for every flow. Pool waiter counts
are sampled at operation entry, not continuously.

These are bounded local measurements of a production-like operation sequence.
They exclude HTTP, browser rendering, hosted network latency, provider quotas,
real Gemini latency, production data volume and Supabase infrastructure. No
latency SLO or maximum-capacity claim is made. Warm-up and local host scheduling
can affect the samples; the decreasing p95 is not proof of a general speedup.
Hosted multi-user performance and visual browser acceptance remain separate.

## Repeat locally

Start Docker Desktop, then from the repository root:

```powershell
docker run --detach --rm --name gethired-interview-audit --publish 127.0.0.1:55433:5432 --env POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine
npm.cmd run test:interviews:postgres
docker stop gethired-interview-audit
```

The container has no host data mount; its unauthenticated development port is
bound only to loopback. The audit rejects non-loopback connection hosts and URL
query overrides. `INTERVIEW_POSTGRES_URL` can select another disposable local
PostgreSQL server; never use a tunnel to a hosted database. A random database
name is generated internally, and only that database is dropped in `finally`.
The script writes a new timestamped report even on a test failure and refuses
to overwrite an existing report. The external container is stopped separately.

No hosted migration, environment change, pool-size change, account provisioning
or deployment is required. The application implementation required no fixes.

Final validation: `npm.cmd run typecheck` and `git diff --check` passed. An
operator query confirmed no generated audit databases remained, and the
auto-removing audit container was stopped. No manual cleanup remains.
