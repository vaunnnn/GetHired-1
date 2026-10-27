import assert from "node:assert/strict";
import { test } from "node:test";
import { createApiClient } from "../src/lib/api-client";

const current = { user: { id: "student", role: "student", displayName: "Student", email: "student@example.test", student: { studentNumber: "12345678", firstName: "Test", lastName: "Student", course: "BSCS", yearLevel: "4" } }, session: { expiresAt: "2099-01-01T00:00:00.000Z", rememberMe: false } };
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
    return ok(current);
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

test("recovery returns the refresh projection with three requests; expired me needs four", async () => {
  for (const sessionRead of [false, true]) {
    const calls: string[] = [];
    const client = createApiClient({ lock: mutex(), notify() {}, fetcher: async input => {
      const path = String(input); calls.push(path);
      if (path.endsWith("/me")) return failure(401, "SESSION_EXPIRED");
      if (path.endsWith("/csrf")) return ok({ csrfToken: "same-binding" });
      return ok(current);
    } });
    assert.deepEqual(await (sessionRead ? client.me() : client.refresh()), current);
    assert.deepEqual(calls, [...(sessionRead ? ["/api/auth/me"] : []), "/api/auth/me", "/api/auth/csrf", "/api/auth/refresh"]);
  }
});

test("a recovered business read retries its original endpoint once", async () => {
  let expired = true;
  const calls: string[] = [];
  const client = createApiClient({ lock: mutex(), notify() {}, fetcher: async input => {
    const path = String(input); calls.push(path);
    if (path.endsWith("/csrf")) return ok({ csrfToken: "same-binding" });
    if (path.endsWith("/refresh")) { expired = false; return ok(current); }
    if (expired) return failure(401, "SESSION_EXPIRED");
    return ok({ company: "verified" });
  } });
  assert.deepEqual(await client.get("/api/companies/example"), { company: "verified" });
  assert.equal(calls.filter(path => path === "/api/companies/example").length, 2);
  assert.equal(calls.filter(path => path.endsWith("/me")).length, 1);
});

test("logout queued during refresh invalidates its projection and then revokes without replay", async () => {
  let release!: () => void, started!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const requested = new Promise<void>(resolve => { started = resolve; });
  let logoutCalls = 0;
  const client = createApiClient({ lock: mutex(), notify() {}, fetcher: async input => {
    const path = String(input);
    if (path.endsWith("/me")) return failure(401, "SESSION_EXPIRED");
    if (path.endsWith("/csrf")) return ok({ csrfToken: "same-binding" });
    if (path.endsWith("/logout")) { logoutCalls++; return ok({ loggedOut: true }); }
    started(); await pending; return ok(current);
  } });
  const recovery = assert.rejects(client.refresh(), { code: "SESSION_EXPIRED" });
  await requested;
  const logout = client.logout(); release();
  await Promise.all([recovery, logout]);
  assert.equal(logoutCalls, 1);
});

test("malformed refresh projections never authorize recovery", async () => {
  for (const value of [{ session: current.session }, { ...current, user: { ...current.user, role: "root" } }]) {
    const client = createApiClient({ lock: mutex(), notify() {}, fetcher: async input => String(input).endsWith("/me")
      ? failure(401, "SESSION_EXPIRED") : String(input).endsWith("/csrf") ? ok({ csrfToken: "csrf" }) : ok(value) });
    await assert.rejects(client.refresh(), { code: "SERVICE_UNAVAILABLE" });
  }
});

test("definitive refresh denial notifies the workspace immediately", async () => {
  const reasons: string[] = [];
  const client = createApiClient({ lock: mutex(), notify() {}, fetcher: async input => String(input).endsWith("/csrf")
    ? ok({ csrfToken: "csrf" }) : failure(401, "SESSION_EXPIRED") });
  const unsubscribe = client.subscribeSessionChanges(reason => reasons.push(reason));
  await assert.rejects(client.refresh(), { code: "SESSION_EXPIRED" });
  assert.deepEqual(reasons, ["denied"]); unsubscribe();
});

test("an auth change during the under-lock recheck discards the old user without rotating or declaring denial", async () => {
  let release!: () => void;
  const response = new Promise<void>(resolve => { release = resolve; });
  let requested!: () => void;
  const started = new Promise<void>(resolve => { requested = resolve; });
  const reasons: string[] = [], calls: string[] = [];
  const client = createApiClient({ lock: mutex(), notify() {}, fetcher: async input => {
    calls.push(String(input)); requested(); await response; return ok(current);
  } });
  const unsubscribe = client.subscribeSessionChanges(reason => reasons.push(reason));
  const recovery = assert.rejects(client.refresh(), { code: "SESSION_EXPIRED" });
  await started; client.invalidateSession(); release(); await recovery;
  assert.deepEqual(calls, ["/api/auth/me"]);
  assert.deepEqual(reasons, ["changed"]); unsubscribe();
});

function versionStore() {
  let value: string | null = null;
  return { read: () => value, write: (next: string) => { value = next; } };
}

test("concurrent business writes initialize CSRF once and can overlap while each sends exactly once", async () => {
  const bindingVersion = versionStore(); let csrfCalls = 0, writes = 0, active = 0, max = 0;
  let release!: () => void; const barrier = new Promise<void>(resolve => { release = resolve; });
  const client = createApiClient({ lock: mutex(), sharedLock: work => work(), bindingVersion, notify() {}, fetcher: async (input, init) => {
    if (String(input).endsWith("/csrf")) { csrfCalls++; return ok({ csrfToken: "bound-token" }); }
    assert.equal(new Headers(init?.headers).get("X-CSRF-Token"), "bound-token");
    writes++; max = Math.max(max, ++active); if (writes === 3) release(); await barrier; active--; return ok({});
  } });
  await Promise.all(Array.from({ length: 3 }, () => client.mutate("/api/companies/example", "PATCH", {})));
  assert.equal(csrfCalls, 1); assert.equal(writes, 3); assert.equal(max, 3);
});

test("another tab's login invalidates cached CSRF synchronously through the marker, before notifications", async () => {
  const lock = mutex(), bindingVersion = versionStore(); let token = "before", posts = 0, csrfCalls = 0;
  const fetcher: typeof fetch = async (input, init) => {
    const path = String(input);
    if (path.endsWith("/csrf")) { csrfCalls++; return ok({ csrfToken: token }); }
    assert.equal(new Headers(init?.headers).get("X-CSRF-Token"), token);
    if (path.endsWith("/login")) { token = "after"; return ok(current); }
    posts++; return ok({});
  };
  const first = createApiClient({ lock, bindingVersion, fetcher, notify() {} });
  const second = createApiClient({ lock, bindingVersion, fetcher, notify() {} });
  await first.mutate("/api/companies/example", "PATCH", {});
  await second.login({ identifier: "student", password: "test" });
  await first.mutate("/api/companies/example", "PATCH", {});
  assert.equal(posts, 2); assert.equal(csrfCalls, 4);
});

test("a binding change while waiting for the shared lock reinitializes before sending, never resends a write", async () => {
  const bindingVersion = versionStore(); let firstLock = true, csrfCalls = 0, writes = 0;
  const client = createApiClient({ lock: mutex(), bindingVersion, notify() {}, sharedLock: async work => {
    if (firstLock) { firstLock = false; bindingVersion.write("new-binding"); }
    return work();
  }, fetcher: async input => {
    if (String(input).endsWith("/csrf")) { csrfCalls++; return ok({ csrfToken: "token" }); }
    writes++; return ok({});
  } });
  await client.mutate("/api/companies/example", "PATCH", {});
  assert.equal(csrfCalls, 2); assert.equal(writes, 1);
});

test("CSRF failure invalidates memory without replay; blocked storage uses exclusive fresh CSRF", async () => {
  let csrfCalls = 0, writes = 0;
  const client = createApiClient({ lock: mutex(), bindingVersion: versionStore(), notify() {}, fetcher: async input => {
    if (String(input).endsWith("/csrf")) { csrfCalls++; return ok({ csrfToken: "token" }); }
    writes++; return failure(403, "CSRF_FAILED");
  } });
  await assert.rejects(client.mutate("/api/companies/example", "PATCH", {}), { code: "CSRF_FAILED" });
  assert.equal(writes, 1);
  await assert.rejects(client.mutate("/api/companies/example", "PATCH", {}), { code: "CSRF_FAILED" });
  assert.equal(csrfCalls, 2); assert.equal(writes, 2);
  const fallback = createApiClient({ lock: mutex(), sharedLock: async () => { assert.fail("blocked storage used a shared lock"); },
    bindingVersion: { read() { throw new Error("blocked"); }, write() {} }, notify() {}, fetcher: async input => String(input).endsWith("/csrf") ? ok({ csrfToken: "fresh" }) : ok({}) });
  await fallback.mutate("/api/companies/example", "PATCH", {});
  const readOnly = createApiClient({ lock: mutex(), sharedLock: async () => { assert.fail("read-only storage used shared mutations"); },
    bindingVersion: { read: () => "prior", write() { throw new Error("read-only"); } }, notify() {},
    fetcher: async input => String(input).endsWith("/csrf") ? ok({ csrfToken: "fresh" }) : ok({}) });
  await readOnly.mutate("/api/companies/example", "PATCH", {});
});

test("unstable binding hints are bounded and never send a mutation before verification", async () => {
  let csrfCalls = 0;
  const client = createApiClient({ lock: mutex(), sharedLock: work => work(), bindingVersion: { read: () => null, write() {} },
    notify() {}, fetcher: async input => { assert.ok(String(input).endsWith("/csrf")); csrfCalls++; return ok({ csrfToken: "token" }); } });
  await assert.rejects(client.mutate("/api/companies/example", "PATCH", {}), { code: "SESSION_CHANGED" });
  assert.equal(csrfCalls, 3);
});
