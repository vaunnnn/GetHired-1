// Actual production gateway over HTTP against the local Postman simulation.
import assert from "node:assert/strict"
import { writeFile } from "node:fs/promises"
import { createApiProxy } from "../src/server/proxy/handler.js"

const base = process.env.SESSION_SIM_URL ?? "http://127.0.0.1:4510/session"
const reports = []
const proxy = createApiProxy(() => ({
  apiOrigin: base,
  gatewaySecret: "ab".repeat(32),
  production: false,
  timeoutMs: 2000,
}))
for (const [mode, status] of [
  ["current", 200],
  ["expired", 401],
  ["outage", 503],
] as const) {
  const reset = await fetch(`${base}/control/reset?mode=${mode}`, {
    method: "POST",
  })
  assert.equal(reset.status, 200)
  const response = await proxy(new Request("http://gateway.test/api/auth/me"))
  assert.equal(response.status, status)
  assert.match(
    response.headers.get("server-timing")!,
    /^upstream;dur=\d+(?:\.\d+)?, gateway;dur=\d+(?:\.\d+)?$/,
  )
  assert.equal(response.headers.get("cache-control"), "private, no-store")
  const result = await response.json()
  if (mode !== "current")
    assert.equal(
      result.error.code,
      mode === "expired" ? "SESSION_EXPIRED" : "SERVICE_UNAVAILABLE",
    )
  const trace = (await (await fetch(`${base}/control/trace`)).json()).data
  assert.equal(
    trace.length,
    1,
    "gateway must never replay a denied or unavailable request",
  )
  assert.equal(trace[0].path, "/api/auth/me")
  reports.push({
    mode,
    status,
    serverTiming: response.headers.get("server-timing"),
    requestCount: trace.length,
  })
}
await writeFile(
  "docs/performance/gateway-timing-local.json",
  JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      evidence:
        "Production gateway against local Postman fixture; no live provider or database",
      node: process.version,
      reports,
    },
    null,
    2,
  ) + "\n",
)
console.log(
  "Gateway timing audit passed: current, expired and unavailable; one HTTP request per scenario.",
)
