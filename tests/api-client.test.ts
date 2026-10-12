import assert from "node:assert/strict";
import { test } from "node:test";
import { createApiClient } from "../src/lib/api-client";

const current = { user: { id: "student", role: "student" }, session: { expiresAt: "later" } };
const ok = (data: unknown) => Response.json({ data, requestId: "request" });
const failure = (status: number, code: string) => Response.json({ error: { code, message: code }, requestId: "request" }, { status });
function mutex() {
  let tail = Promise.resolve();
  return <T>(work: () => Promise<T>): Promise<T> => {
    const result = tail.then(work);
    tail = result.then(() => {}, () => {});
    return result;
  };
}

test("two tabs serialize refresh, recheck shared cookies, and refresh only once", async () => {
  const lock = mutex();
  let refreshed = false;
  let count = 0;
  const fetcher: typeof fetch = async (input, init) => {
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.credentials, "same-origin");
    const path = String(input);
    if (path.endsWith("/me")) return refreshed ? ok(current) : failure(401, "SESSION_EXPIRED");
    if (path.endsWith("/csrf")) return ok({ csrfToken: "binding" });
    assert.ok(path.endsWith("/refresh"));
    assert.equal(new Headers(init?.headers).get("X-CSRF-Token"), "binding");
    count++;
    refreshed = true;
    return ok({ session: current.session });
  };
  const first = createApiClient({ fetcher, lock, notify() {} });
  const second = createApiClient({ fetcher, lock, notify() {} });
  const sessions = await Promise.all([first.me(), first.me(), second.me()]);
  assert.equal(count, 1);
  assert.deepEqual(sessions, [current, current, current]);
});

test("login rotates CSRF, logout uses the new binding; mutations are never replayed", async () => {
  let token = "before";
  const calls: string[] = [];
  const client = createApiClient({ lock: mutex(), notify() {}, fetcher: async (input, init) => {
    const path = String(input);
    calls.push(path);
    if (path.endsWith("/csrf")) return ok({ csrfToken: token });
    assert.equal(new Headers(init?.headers).get("X-CSRF-Token"), token);
    if (path.endsWith("/login")) { token = "after"; return ok(current); }
    if (path.endsWith("/logout")) return ok({ loggedOut: true });
    throw new Error("timeout after a possible commit");
  } });
  await client.login({ identifier: "21100123", password: "test", rememberMe: false });
  assert.deepEqual(calls, ["/api/auth/csrf", "/api/auth/login", "/api/auth/csrf"]);
  await client.logout();
  await assert.rejects(client.mutate("/api/admin/companies", "POST", {}), { code: "SERVICE_UNAVAILABLE" });
  assert.equal(calls.filter(path => path === "/api/admin/companies").length, 1);
});

test("outages are retried once only for reads and do not become expired sessions", async () => {
  let calls = 0;
  const client = createApiClient({ lock: mutex(), fetcher: async () => { calls++; return failure(503, "SERVICE_UNAVAILABLE"); } });
  await assert.rejects(client.me(), { status: 503, code: "SERVICE_UNAVAILABLE" });
  assert.equal(calls, 2);
});

test("failed refresh is bounded, releases the lock, and never authorizes a revoked session", async () => {
  let refreshes = 0;
  const client = createApiClient({ lock: mutex(), fetcher: async input => {
    if (String(input).endsWith("/csrf")) return ok({ csrfToken: "csrf" });
    if (String(input).endsWith("/refresh")) refreshes++;
    return failure(401, "SESSION_EXPIRED");
  } });
  await assert.rejects(client.me(), { code: "SESSION_EXPIRED" });
  assert.equal(refreshes, 1);
  await assert.rejects(client.me(), { code: "SESSION_EXPIRED" });
  assert.equal(refreshes, 2);
});

test("credentials and CSRF cannot be sent to external or traversed paths", async () => {
  const client = createApiClient({ lock: mutex(), fetcher: async () => { throw new Error("Must not fetch"); } });
  for (const path of ["https://evil.test/api/me", "//evil.test/api/me", "/api/../private", "/api/auth/me#fragment"])
    await assert.rejects(client.get(path), /same-origin/);
});
