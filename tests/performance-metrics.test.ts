import assert from "node:assert/strict"
import { test } from "node:test"
import { summarizeNavigation } from "./performance-metrics.mjs"

test("recovery visibility spans documents and ends at each pagehide or shell readiness", () => {
  const result = summarizeNavigation(
    [
      { kind: "document", documentId: 1, at: 100, duration: 0 },
      { kind: "checking_start", documentId: 1, at: 120, duration: 0 },
      { kind: "checking_end", documentId: 1, at: 400, duration: 0 },
      { kind: "document", documentId: 2, at: 450, duration: 0 },
      { kind: "checking_start", documentId: 2, at: 500, duration: 0 },
      { kind: "long_task", documentId: 1, at: 200, duration: 60 },
      { kind: "long_task", documentId: 2, at: 700, duration: 80 },
    ],
    [
      {
        path: "/api/auth/me",
        status: 401,
        durationMs: 25,
        errorCode: "UNAUTHENTICATED",
        requestId: "id",
      },
    ],
    100,
    600,
  )
  assert.equal(result.checkingVisibleMs, 380)
  assert.equal(result.documentCount, 2)
  assert.equal(result.apiRequestCount, 1)
  assert.equal(result.sessionReadCount, 1)
  assert.deepEqual(result.longTasks, { count: 1, totalMs: 60, maxMs: 60 })
  assert.deepEqual(result.deniedReads, [
    {
      path: "/api/auth/me",
      status: 401,
      durationMs: 25,
      errorCode: "UNAUTHENTICATED",
      requestId: "id",
    },
  ])
})
