import assert from "node:assert/strict";
import { test } from "node:test";
import { readSession } from "../src/server/session-reader";

const config = () => ({ apiOrigin: "https://api.example", gatewaySecret: "ab".repeat(32),
  production: true, trustedIpHeader: "x-ingress-ip", timeoutMs: 1000 });

test("page checks forward cookies through the trusted gateway using GET without rotation or caching", async () => {
  const current = { user: { id: "account", role: "admin" }, session: { expiresAt: "later" } };
  const result = await readSession(new Headers({ cookie: "session=opaque", "x-ingress-ip": "192.0.2.1",
    "x-gethired-gateway": "forged", "x-gethired-client-ip": "1.1.1.1", origin: "https://evil.test" }), config,
    async (url, init) => {
      assert.equal(String(url), "https://api.example/api/auth/me");
      assert.equal(init?.method, "GET");
      assert.equal(init?.cache, "no-store");
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("cookie"), "session=opaque");
      assert.equal(headers.get("x-gethired-gateway"), config().gatewaySecret);
      assert.equal(headers.get("x-gethired-client-ip"), "192.0.2.1");
      assert.equal(headers.get("origin"), null);
      return Response.json({ data: current, requestId: "id" });
    });
  assert.deepEqual(result, { kind: "authenticated", current });
});

test("page checks distinguish invalid sessions from backend outages and reject missing ingress", async () => {
  for (const status of [401, 503]) {
    const result = await readSession(new Headers({ "x-ingress-ip": "192.0.2.1" }), config,
      async () => Response.json({ error: { code: status === 401 ? "UNAUTHENTICATED" : "SERVICE_UNAVAILABLE" } }, { status }));
    assert.equal(result.kind, status === 401 ? "unauthenticated" : "unavailable");
  }
  assert.equal((await readSession(new Headers(), config, async () => { throw new Error("Must not fetch"); })).kind, "unavailable");
});
