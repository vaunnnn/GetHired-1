import assert from "node:assert/strict";
import { test } from "node:test";
import { comparePerformance, distribution } from "./performance-release.mjs";
import { summarizeTelemetry } from "./performance-telemetry.mjs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function report(ms: number, n = 30): any {
  return {
    checks: ["admin", "student"].flatMap((role) => [
      ...[
        "/api/auth/me",
        role === "admin"
          ? "/api/admin/companies?page=1"
          : "/api/companies?page=1",
      ].map((path) => ({
        role,
        label: "sequential reads",
        path,
        samples: Array.from({ length: n }, () => ({
          status: 200,
          durationMs: ms,
        })),
      })),
      {
        role,
        label: "focus revalidation",
        checkingVisibleMs: 0,
        blocked: false,
        success: true,
      },
    ]),
    runs: ["admin", "student"].flatMap((role) =>
      Array.from({ length: n }, (_, index) => ({
        role,
        label: `missing access recovery ${index + 1}`,
        usableMs: ms,
        success: true,
        documentCount: 1,
      })),
    ),
  };
}

test("release comparison uses raw samples and requires both roles at 30 samples", () => {
  assert.equal(
    comparePerformance([report(1000)], [report(500)]).performanceGatesMet,
    true,
  );
  const short = comparePerformance([report(1000, 29)], [report(100)]);
  assert.equal(short.performanceGatesMet, false);
  assert.equal(
    short.gates.filter((gate) => gate.status === "insufficient_samples").length,
    6,
  );
  const absent = comparePerformance([report(1000)], [{ checks: [], runs: [] }]);
  assert.equal(absent.performanceGatesMet, false);
});

test("latency cannot compensate for a worse error rate, lost role or partial audit", () => {
  const preview = report(100);
  preview.checks[0].samples[0].status = 503;
  assert.equal(
    comparePerformance([report(1000)], [preview]).performanceGatesMet,
    false,
  );
  const partial = report(100);
  partial.failure = "timeout";
  assert.equal(
    comparePerformance([report(1000)], [partial]).performanceGatesMet,
    false,
  );
  const role = report(100);
  role.checks = role.checks.filter((check: any) => check.role !== "student");
  assert.equal(
    comparePerformance([report(1000)], [role]).performanceGatesMet,
    false,
  );
});

test("recovery must stay in one document and routine checks need measured overlay evidence", () => {
  const preview = report(100);
  preview.runs[0].documentCount = 2;
  assert.equal(
    comparePerformance([report(1000)], [preview]).performanceGatesMet,
    false,
  );
  preview.runs[0].documentCount = 1;
  const focus = preview.checks.find(
    (check: any) => check.label === "focus revalidation",
  );
  focus.checkingVisibleMs = 1;
  assert.equal(
    comparePerformance([report(1000)], [preview]).performanceGatesMet,
    false,
  );
  delete focus.checkingVisibleMs;
  assert.equal(
    comparePerformance([report(1000)], [preview]).performanceGatesMet,
    false,
  );
});

test("percentiles exclude invalid durations and failed HTTP samples", () => {
  assert.deepEqual(distribution([1, 2, 3, Number.NaN, -1, 4]), {
    n: 4,
    medianMs: 3,
    p95Ms: 4,
  });
  const preview = report(100);
  preview.checks[0].samples.push({ status: 503, durationMs: 0 });
  const gate: any = comparePerformance([report(1000)], [preview]).gates.find(
    (gate: any) => gate.scenario === "session" && gate.role === "admin",
  );
  assert.ok(gate);
  assert.equal(gate.after.n, 30);
  assert.equal(gate.after.medianMs, 100);
  assert.equal(gate.after.failures, 1);
  assert.equal(gate.status, "fail");
});

test("telemetry reports connection reuse and missing evidence without retaining log identities", () => {
  const result = summarizeTelemetry([
    {
      event: "api.request.completed",
      method: "GET",
      route: "/api/auth/me",
      status: 200,
      actorId: "private-account",
      requestId: "private-request",
      password: "private-secret",
      deployment: {
        serviceRegion: "sin",
        databaseRegion: "ap-southeast-1",
        firstRequest: true,
      },
      connections: { firstSeen: 1, reused: 2, waitingMax: 3 },
      timings: { pool: { durationMs: 8, count: 3 } },
    },
    {
      event: "api.request.completed",
      method: "GET",
      route: "/api/auth/me",
      status: 503,
    },
    { event: "other", route: "/api/auth/me", method: "GET" },
  ]);
  assert.equal(result.requests, 2);
  assert.equal(result.routes[0].failedRequests, 1);
  assert.equal(result.routes[0].reused, 2);
  assert.equal(result.routes[0].waitingMax, 3);
  assert.equal(result.routes[0].timings.pool.medianMs, 8);
  assert.equal(result.routes[1].waitingMax, null);
  assert.equal(JSON.stringify(result).includes("private-"), false);
});

test("independent-user runner rejects live and unclassified targets before browser startup", () => {
  const script = fileURLToPath(
    new URL("./performance-staging.mjs", import.meta.url),
  );
  for (const [target, environment, message] of [
    [
      "https://gethired-1.vercel.app",
      "staging",
      "must not target the live baseline",
    ],
    [
      "https://preview.example.com",
      "production",
      "verified nonproduction target",
    ],
  ]) {
    const result = spawnSync(
      process.execPath,
      [script, target, "unused-output"],
      {
        env: { ...process.env, PERF_TARGET_ENVIRONMENT: environment },
        input: "[]",
        encoding: "utf8",
        timeout: 5000,
      },
    );
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.includes(message));
  }
});
