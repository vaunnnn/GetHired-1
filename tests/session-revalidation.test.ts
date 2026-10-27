import assert from "node:assert/strict";
import { test } from "node:test";
import type { CurrentUser } from "@gethired/contracts";
import { ApiClientError } from "../src/lib/api-client";
import {
  createSessionRevalidation,
  SESSION_FRESHNESS_MS,
} from "../src/lib/session-revalidation";

const initial: CurrentUser = {
  user: {
    id: "admin",
    role: "admin",
    displayName: "Admin",
    email: "admin@example.test",
    student: null,
  },
  session: { expiresAt: "2099-01-01T00:00:00.000Z", rememberMe: false },
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("fresh initial state skips mount/focus bursts; stale bursts coalesce and successful checks renew freshness", async () => {
  let now = 0,
    calls = 0,
    accepted = 0;
  const response = deferred<CurrentUser>();
  const checker = createSessionRevalidation({
    initial,
    now: () => now,
    read: () => {
      calls++;
      return response.promise;
    },
    onCurrent() {
      accepted++;
    },
    onDenied() {
      assert.fail();
    },
    onAccountChange() {
      assert.fail();
    },
    onUnavailable() {
      assert.fail();
    },
  });
  await Promise.all([checker.check(), checker.check(), checker.check()]);
  assert.equal(calls, 0);
  now = SESSION_FRESHNESS_MS;
  const checks = [checker.check(), checker.check(), checker.check()];
  assert.equal(calls, 1);
  response.resolve(initial);
  await Promise.all(checks);
  assert.equal(accepted, 1);
  await checker.check();
  assert.equal(calls, 1);
});

test("auth change invalidates an in-flight result and requires a new authoritative check", async () => {
  const first = deferred<CurrentUser>();
  let calls = 0,
    accepted = 0,
    denied = 0;
  const checker = createSessionRevalidation({
    initial,
    read: async () => {
      if (++calls === 1) return first.promise;
      throw new ApiClientError(401, "SESSION_EXPIRED", "revoked");
    },
    onCurrent() {
      accepted++;
    },
    onDenied() {
      denied++;
    },
    onAccountChange() {
      assert.fail();
    },
    onUnavailable() {
      assert.fail();
    },
  });
  const pending = checker.check(true);
  checker.invalidate();
  first.resolve(initial);
  await pending;
  assert.equal(calls, 2);
  assert.equal(accepted, 0);
  assert.equal(denied, 1);
});

test("transient failures preserve the workspace and can be retried; account changes never replace its private state", async () => {
  let outage = true,
    changed = 0,
    failures = 0;
  const checker = createSessionRevalidation({
    initial,
    read: async () => {
      if (outage)
        throw new ApiClientError(503, "SERVICE_UNAVAILABLE", "offline");
      return { ...initial, user: { ...initial.user, id: "another-admin" } };
    },
    onCurrent() {
      assert.fail();
    },
    onDenied() {
      assert.fail();
    },
    onAccountChange() {
      changed++;
    },
    onUnavailable() {
      failures++;
    },
  });
  await checker.check(true);
  assert.equal(failures, 1);
  assert.equal(changed, 0);
  outage = false;
  await checker.check(true);
  assert.equal(changed, 1);
});

test("an expired server projection bypasses freshness, and unmounted providers ignore pending results", async () => {
  let calls = 0;
  const response = deferred<CurrentUser>();
  const checker = createSessionRevalidation({
    initial: {
      ...initial,
      session: { ...initial.session, expiresAt: "2000-01-01T00:00:00.000Z" },
    },
    read: () => {
      calls++;
      return response.promise;
    },
    onCurrent() {
      assert.fail();
    },
    onDenied() {
      assert.fail();
    },
    onAccountChange() {
      assert.fail();
    },
    onUnavailable() {
      assert.fail();
    },
  });
  const pending = checker.check();
  assert.equal(calls, 1);
  checker.stop();
  response.resolve(initial);
  await pending;
});
