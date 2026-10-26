# Session audit simulation

Created 2026-10-26 from the repository auth contract and existing browser fixture; no workspace mock was downloaded or published.

## Purpose

Run the production API client over HTTP to measure its request chain and mutation serialization. The sole member is `postman/mocks/session-audit/config.yaml`; control endpoints select expired/current/outage state.

## Execution

Start `postman simulation run postman/simulations/session-audit.sim.yaml --port 4510 --output ndjson --no-history`, then run `node --import tsx tests/session-network-audit.ts` and `node --import tsx tests/mutation-browser-audit.mjs` sequentially with Node 22. Both reset shared fixture state. Stop the simulation after the tests. Current results: `docs/performance/phase4-network-audit.json` and `phase4-browser-mutations.json`; earlier reports retain their baselines. CLI request events establish that the member received the calls.

## Assumptions

- Observed 2026-10-26: this fixture adds 75 ms per application request. Measured totals demonstrate request sequencing, not live service latency.
- Observed 2026-10-26 Phase 4: the network audit uses an injected mutex/shared-work callback and in-memory version hint to isolate request counts. The separate mutation browser audit exercises the production defaults with native navigator.locks, two Chrome tabs and HttpOnly fixture cookies through the gateway.
- The fixture does not verify JWTs, CSRF signatures, cookies or database authorization. Those are verified by separate tests; its responses must not be read as proof of security.

## Observations

<!-- begin:observations -->
- 2026-10-26 Phase 4: three writes use one CSRF GET plus three overlapping PATCH requests. The browser mode additionally covers anonymous issuance, concurrent writes versus login/logout, version invalidation, CSRF/uncertain errors without replay and storage fallback; maximum three active writes, zero auth overlaps. Cookie/token pairing is a fixture invariant, not proof of backend signatures or provider/database authorization.
- 2026-10-26 Phase 3: refresh returns the verified user alongside the session. The real client used 3 requests for refresh and 4 for expired me, with 6 mutation and 2 outage requests unchanged. Trace confirmed all 15 application calls reached this member (23 events including controls). This models the amended contract, not provider rotation or database security.
- 2026-10-26: `tests/gateway-timing-audit.ts` exercised the production gateway against this member for current, expired and unavailable reads. Each returned numeric gateway/upstream timings with the expected 200/401/503 status and exactly one upstream request. CLI trace confirmed all three arrived. Sanitized evidence: `docs/performance/gateway-timing-local.json`.
- 2026-10-26: the sole member served every tested request; none stayed silent. Refresh, expired session read, concurrent mutations and outage completed with asserted request counts. See the dated sanitized network audit.
<!-- end:observations -->

## What didn't work

- 2026-10-26, CLI 1.73.0: a directory member path failed with `Mock 'file' must point to a file`; pointing to config.yaml resolved it. The manifest also requires `version: 1`. The checked-in configuration contains both fixes.
