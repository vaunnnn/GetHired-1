// Production client + gateway + native browser locks/cookies, over the local Postman simulation.
// No deployment credentials, actual user or provider state participate.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { createApiProxy } from "../src/server/proxy/handler.ts";

const base = process.env.SESSION_SIM_URL ?? "http://127.0.0.1:4510/session";
const root = fileURLToPath(new URL("../", import.meta.url));
const result = await build({
  stdin: {
    contents:
      'import {createApiClient} from "./src/lib/api-client"; window.client=createApiClient();',
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
});
const checks = [],
  sockets = [];
const proxy = createApiProxy(() => ({
  apiOrigin: base,
  gatewaySecret: "ab".repeat(32),
  production: false,
  timeoutMs: 5000,
}));
const site = createServer(async (req, res) => {
  if (req.url === "/") {
    res.setHeader("Content-Type", "text/html");
    return res.end('<!doctype html><script src="/client.js"></script>');
  }
  if (req.url === "/client.js") {
    res.setHeader("Content-Type", "text/javascript");
    return res.end(result.outputFiles[0].text);
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const response = await proxy(
    new Request(`http://gateway.test${req.url}`, {
      method: req.method,
      headers: req.headers,
      ...(["GET", "HEAD"].includes(req.method)
        ? {}
        : { body: Buffer.concat(chunks) }),
    }),
  );
  res.statusCode = response.status;
  for (const [key, value] of response.headers)
    if (key !== "set-cookie") res.setHeader(key, value);
  res.setHeader("Set-Cookie", response.headers.getSetCookie());
  res.end(Buffer.from(await response.arrayBuffer()));
});
let chrome;
async function until(work, label) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    if (await work()) return;
    await delay(25);
  }
  throw new Error(`Timed out: ${label}`);
}
async function control(path) {
  const response = await fetch(`${base}/control/${path}`, { method: "POST" });
  assert.equal(response.status, 200);
  return (await response.json()).data;
}
async function state() {
  const response = await fetch(`${base}/control/state`);
  return (await response.json()).data;
}
async function tab(port, origin) {
  const target = await (
    await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {
      method: "PUT",
    })
  ).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  sockets.push(ws);
  await once(ws, "open");
  let seq = 0;
  const pending = new Map();
  ws.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data),
      task = pending.get(message.id);
    if (task) {
      pending.delete(message.id);
      message.error
        ? task.reject(new Error(message.error.message))
        : task.resolve(message.result);
    }
  });
  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error("Browser evaluation failed");
    return r.result.value;
  };
  await call("Page.enable");
  await call("Runtime.enable");
  await call("Page.navigate", { url: origin });
  await until(() => evaluate("!!window.client"), "client bundle");
  return { evaluate };
}
async function record(label, work) {
  await work();
  checks.push(label);
  console.log(`PASS: ${label}`);
}
try {
  await control("reset?mode=browser");
  site.listen(0, "127.0.0.1");
  await once(site, "listening");
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const debugPort = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  const profile = await mkdtemp(join(tmpdir(), "gethired-mutations-"));
  chrome = spawn(
    process.env.CHROME_PATH ??
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    [
      "--headless=new",
      "--no-first-run",
      `--remote-debugging-port=${debugPort}`,
      "--remote-debugging-address=127.0.0.1",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  await until(async () => {
    try {
      return (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok;
    } catch {
      return false;
    }
  }, "Chrome");
  const origin = `http://127.0.0.1:${site.address().port}`;
  const first = await tab(debugPort, origin),
    second = await tab(debugPort, origin);
  const mutate = "client.mutate('/api/admin/companies','PATCH',{})";
  const login =
    "client.login({identifier:'audit@example.test',password:'fixture-only'})";

  await record(
    "anonymous CSRF initialization is exclusive across two tabs and does not authorize business writes",
    async () => {
      const results = await Promise.all(
        [first, second].map((t) =>
          t.evaluate(`${mutate}.then(()=>200,e=>e.status)`),
        ),
      );
      assert.deepEqual(results, [401, 401]);
      const s = await state();
      assert.equal(s.issued, 1);
      assert.equal(s.csrfCalls, 2);
      assert.equal(s.writeCalls, 2);
      assert.equal(
        await first.evaluate("document.cookie.includes('phase4-binding')"),
        false,
        "binding must remain HttpOnly",
      );
    },
  );
  await first.evaluate(login);
  await second.evaluate(mutate);

  await record(
    "shared native locks overlap writes and an exclusive logout waits for all of them",
    async () => {
      await control("hold?value=true");
      await first.evaluate(
        `window.writesDone=false; Promise.all([${mutate},${mutate}]).then(()=>window.writesDone=true); void 0`,
      );
      await second.evaluate(
        `window.writeDone=false; ${mutate}.then(()=>window.writeDone=true); void 0`,
      );
      await until(
        async () => (await state()).active === 3,
        "three concurrent writes",
      );
      await second.evaluate(
        "window.logoutDone=false; client.logout().then(()=>window.logoutDone=true); void 0",
      );
      await delay(100);
      assert.equal(await second.evaluate("window.logoutDone"), false);
      assert.equal((await state()).overlaps, 0);
      await control("hold?value=false");
      await until(
        async () =>
          (await first.evaluate("window.writesDone")) &&
          (await second.evaluate("window.writeDone && window.logoutDone")),
        "writes then logout complete",
      );
      assert.ok((await state()).maxActive >= 3);
      assert.equal((await state()).overlaps, 0);
      assert.equal(
        await first.evaluate(`${mutate}.then(()=>200,e=>e.status)`),
        401,
      );
    },
  );

  await first.evaluate(login);
  await record(
    "login in another tab waits for a shared write and invalidates the prior CSRF cache",
    async () => {
      await control("hold?value=true");
      await first.evaluate(
        `window.writeDone=false; ${mutate}.then(()=>window.writeDone=true); void 0`,
      );
      await until(
        async () => (await state()).active === 1,
        "held business write",
      );
      await second.evaluate(
        `window.loginDone=false; ${login}.then(()=>window.loginDone=true); void 0`,
      );
      await delay(100);
      assert.equal(await second.evaluate("window.loginDone"), false);
      await control("hold?value=false");
      await until(
        async () =>
          (await first.evaluate("window.writeDone")) &&
          (await second.evaluate("window.loginDone")),
        "write then login complete",
      );
      await first.evaluate(mutate);
      assert.equal((await state()).overlaps, 0);
    },
  );

  await record(
    "CSRF failures and uncertain responses are surfaced without replaying writes",
    async () => {
      for (const query of ["csrfFailure=1", "uncertain=1"]) {
        const before = (await state()).writeCalls;
        const status = await first.evaluate(
          `client.mutate('/api/admin/companies?${query}','PATCH',{}).then(()=>200,e=>e.status)`,
        );
        assert.equal(status, query.startsWith("csrfFailure") ? 403 : 503);
        assert.equal((await state()).writeCalls, before + 1);
      }
    },
  );

  await record(
    "unavailable version storage falls back to exclusive fresh-CSRF mutations",
    async () => {
      const before = (await state()).csrfCalls;
      await first.evaluate(
        "Storage.prototype.getItem = function(){throw new Error('fixture storage unavailable')};",
      );
      await first.evaluate(`Promise.all([${mutate},${mutate}])`);
      assert.equal((await state()).csrfCalls, before + 2);
    },
  );
  await writeFile(
    "docs/performance/phase4-browser-mutations.json",
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        evidence:
          "Actual production client/gateway, native Chrome locks and HttpOnly fixture cookies over Postman; not provider/database authorization",
        checks,
        counters: await state(),
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await control("hold?value=false").catch(() => {});
  for (const ws of sockets) ws.close();
  chrome?.kill();
  site.closeAllConnections();
  await new Promise((resolve) => site.close(resolve));
}
