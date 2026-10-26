// Read test credentials as JSON from stdin. Never writes credentials, cookies or bodies.
// node tests/performance-audit.mjs < credentials.json (prefer an in-memory pipe).
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { browserTimingSource, summarizeNavigation } from "./performance-metrics.mjs";

let input = "";
for await (const part of process.stdin) input += part;
const accounts = JSON.parse(input);
const base = process.env.PERF_URL ?? "https://gethired-1.vercel.app";
const navigationOnly = process.env.PERF_NAV_ONLY === "true";
const sampleCount = Number(process.env.PERF_SAMPLES ?? 30);
assert.ok(Number.isSafeInteger(sampleCount) && sampleCount >= 1 && sampleCount <= 1000, "PERF_SAMPLES must be 1–1000");
const navigationSamples = Number(process.env.PERF_NAV_SAMPLES ?? sampleCount);
const recoverySamples = Number(process.env.PERF_RECOVERY_SAMPLES ?? sampleCount);
for (const count of [navigationSamples, recoverySamples]) assert.ok(Number.isSafeInteger(count) && count >= 1 && count <= 1000, "Navigation/recovery samples must be 1–1000");
const results = { timestamp: new Date().toISOString(), base, node: process.version,
  settings: { navigationOnly, sampleCount, navigationSamples, recoverySamples }, runs: [], checks: [] };
const listener = createServer();
listener.listen(0, "127.0.0.1"); await once(listener, "listening");
const port = listener.address().port;
await new Promise(resolve => listener.close(resolve));
const profile = await mkdtemp(join(tmpdir(), "gethired-performance-"));
const chrome = spawn(process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", "--no-first-run", "--no-default-browser-check", `--remote-debugging-port=${port}`,
  "--remote-debugging-address=127.0.0.1", `--user-data-dir=${profile}`, "about:blank",
], { windowsHide: true, stdio: "ignore" });
let ws;
async function until(work, label, timeout = 90000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await work()) return;
    await delay(50);
  }
  throw new Error(`Timed out: ${label}`);
}
function stats(values) {
  const sorted = [...values].sort((a,b) => a-b);
  return { n: sorted.length, minMs: sorted[0], medianMs: sorted[Math.floor(sorted.length / 2)],
    p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], maxMs: sorted.at(-1) };
}
try {
  await until(async () => { try { return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok; } catch { return false; } }, "Chrome");
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl); await once(ws, "open");
  let sequence = 0;
  const pending = new Map(), requests = new Map(), traffic = [], browserEvents = [], responseTasks = new Set();
  let lastApiFinished = 0;
  ws.addEventListener("message", ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.method === "Runtime.bindingCalled" && msg.params.name === "__getHiredPerfRecord") {
      try {
        const e = JSON.parse(msg.params.payload);
        if (["document", "checking_start", "checking_end", "long_task"].includes(e.kind) &&
          [e.at, e.duration, e.documentId].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0))
          browserEvents.push({ kind: e.kind, at: e.at, duration: e.duration, documentId: e.documentId });
      } catch {}
    }
    if (pending.has(msg.id)) {
      const task = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? task.reject(new Error(msg.error.message)) : task.resolve(msg.result);
    }
    if (msg.method === "Network.requestWillBeSent") {
      const p = msg.params, url = new URL(p.request.url);
      if (url.origin === base) requests.set(p.requestId, { path: url.pathname + url.search, method: p.request.method,
        type: p.type, start: p.timestamp });
    }
    if (msg.method === "Network.responseReceived") {
      const p = msg.params, entry = requests.get(p.requestId);
      if (entry) {
        const headers = new Headers(p.response.headers);
        Object.assign(entry, { status: p.response.status, ttfbMs: Math.round((p.timestamp-entry.start)*1000),
          serverTiming: headers.get("server-timing"), requestId: headers.get("x-request-id"),
          vercelRegion: (headers.get("x-vercel-id") ?? "").split("::")[0] });
      }
    }
    if (msg.method === "Network.loadingFinished") {
      const p = msg.params, entry = requests.get(p.requestId);
      if (entry) {
        if (entry.path.startsWith("/api/")) lastApiFinished = performance.now();
        const record = { ...entry, durationMs: Math.round((p.timestamp-entry.start)*1000), bytes: p.encodedDataLength };
        traffic.push(record); requests.delete(p.requestId);
        if (entry.status === 401 && entry.path.startsWith("/api/")) {
          const task = call("Network.getResponseBody", { requestId: p.requestId }).then(body => {
            const parsed = JSON.parse(body.base64Encoded ? Buffer.from(body.body, "base64").toString("utf8") : body.body);
            if (["UNAUTHENTICATED", "SESSION_EXPIRED", "INVALID_CREDENTIALS"].includes(parsed.error?.code))
              record.errorCode = parsed.error.code;
          }).catch(() => {}).finally(() => responseTasks.delete(task));
          responseTasks.add(task);
        }
      }
    }
    if (msg.method === "Network.loadingFailed") {
      const entry = requests.get(msg.params.requestId);
      if (entry) traffic.push({ ...entry, failed: true, cancelled: !!msg.params.canceled,
        durationMs: Math.round((msg.params.timestamp - entry.start) * 1000) });
      requests.delete(msg.params.requestId);
    }
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const r = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error("Browser evaluation failed");
    return r.result.value;
  };
  await call("Page.enable"); await call("Runtime.enable"); await call("Network.enable");
  async function settleApi() {
    await delay(300);
    let quietSince = performance.now();
    await until(async () => {
      if ([...requests.values()].some(r=>r.path.startsWith("/api/"))) quietSince = performance.now();
      return performance.now() - quietSince > 500;
    }, "initial API responses complete");
    await Promise.allSettled([...responseTasks]);
  }
  await call("Runtime.addBinding", { name: "__getHiredPerfRecord" });
  await call("Page.addScriptToEvaluateOnNewDocument", { source: browserTimingSource });
  const ready = role => evaluate(`location.pathname === '${role === "admin" ? "/admin" : "/dashboard"}' &&
    !!document.querySelector('button') && Object.keys(document.querySelector('button')).some(k=>k.startsWith('__reactProps$')) &&
    [...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Log out' || b.textContent.trim()==='Logout') && !document.body.innerText.includes('Checking your session')`);
  async function navigation(role, label) {
    const start = performance.now(), wallStart = Date.now(), offset = traffic.length, eventOffset = browserEvents.length;
    requests.clear();
    try {
      await call("Page.navigate", { url: `${base}${role === "admin" ? "/admin" : "/dashboard"}` });
      await until(() => ready(role), label);
    } catch (error) {
      await Promise.allSettled([...responseTasks]);
      results.runs.push({ role, label, success: false, elapsedMs: Math.round(performance.now()-start),
        ...summarizeNavigation(browserEvents.slice(eventOffset), traffic.slice(offset), wallStart, Date.now()), traffic: traffic.slice(offset) });
      throw error;
    }
    const usableMs = Math.round(performance.now()-start);
    const shellReady = Date.now();
    await settleApi();
    results.runs.push({ role, label, success: true, usableMs, initialApiCompleteMs: Math.max(usableMs, Math.round(lastApiFinished-start)),
      ...summarizeNavigation(browserEvents.slice(eventOffset), traffic.slice(offset), wallStart, shellReady), traffic: traffic.slice(offset) });
    console.log(`${role}: ${label}: ${usableMs}ms`);
  }
  async function read(path) {
    return evaluate(`(async()=>{const start=performance.now();const r=await fetch(${JSON.stringify(path)},{cache:'no-store',credentials:'same-origin'});await r.arrayBuffer();return {status:r.status,durationMs:Math.round(performance.now()-start)}})()`);
  }
  for (const { role, identifier, password } of accounts) {
    await call("Network.clearBrowserCookies");
    await call("Page.navigate", { url: `${base}/login` });
    await until(() => evaluate("!!document.querySelector('#password') && Object.keys(document.querySelector('#password')).some(k=>k.startsWith('__reactProps$'))"), "login hydration");
    requests.clear();
    const start = performance.now(), wallStart = Date.now(), offset = traffic.length, eventOffset = browserEvents.length;
    await evaluate(`(()=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
      for(const [id,value] of ${JSON.stringify([["identifier",identifier],["password",password]])}){
        const el=document.getElementById(id);setter.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));}
      document.querySelector('form').requestSubmit();})()`);
    await until(() => ready(role), `${role} login`);
    const usableMs = Math.round(performance.now()-start);
    const shellReady = Date.now();
    await settleApi();
    results.runs.push({role,label:"login",usableMs,initialApiCompleteMs:Math.max(usableMs,Math.round(lastApiFinished-start)),
      ...summarizeNavigation(browserEvents.slice(eventOffset), traffic.slice(offset), wallStart, shellReady), traffic:traffic.slice(offset)});
    console.log(`${role}: login: ${usableMs}ms`);
    for (let i=0;i<navigationSamples;i++) await navigation(role, `warm navigation ${i+1}`);
    for (const path of navigationOnly ? [] : ["/api/auth/csrf", "/api/auth/me", role === "admin" ? "/api/admin/companies?page=1&pageSize=20" : "/api/companies?page=1&pageSize=20"]) {
      const samples=[], offset=traffic.length;
      for(let i=0;i<sampleCount;i++) samples.push(await read(path));
      await Promise.allSettled([...responseTasks]);
      const summary=stats(samples.map(s=>s.durationMs));
      const successCount = samples.filter(s=>s.status===200).length;
      results.checks.push({role,label:"sequential reads",path,summary,samples,successCount,
        failureCount:samples.length-successCount,successRate:successCount/samples.length,traffic:traffic.slice(offset)});
      assert.equal(successCount,samples.length,`Read ${path} must succeed; failed samples retained in report`);
      console.log(`${role}: ${path}: median=${summary.medianMs}ms p95=${summary.p95Ms}ms`);
    }
    for(let i=0;i<(navigationOnly?0:3);i++) {
      const offset=traffic.length, start=performance.now();
      const samples=await Promise.all(Array.from({length:4},()=>read("/api/auth/me")));
      assert.ok(samples.every(s=>s.status===200));
      results.checks.push({role,label:"4 concurrent session reads",durationMs:Math.round(performance.now()-start),samples,traffic:traffic.slice(offset)});
    }
    for(let i=0;i<(navigationOnly?0:3);i++) {
      const offset=traffic.length, eventOffset=browserEvents.length, wallStart=Date.now();
      await evaluate("window.dispatchEvent(new Event('focus'))"); await delay(2500);
      const summary=summarizeNavigation(browserEvents.slice(eventOffset),traffic.slice(offset),wallStart,Date.now());
      results.checks.push({role,label:"focus revalidation",traffic:traffic.slice(offset),
        checkingVisibleMs:summary.checkingVisibleMs,
        success:traffic.slice(offset).filter(t=>t.path.startsWith('/api/')).every(t=>t.status===200),
        blocked:await evaluate("!!document.querySelector('[inert], [role=status]')")});
    }
    for(let i=0;i<recoverySamples;i++) {
      // Simulate missing access credentials while retaining the real refresh cookie.
      const {cookies}=await call("Network.getCookies",{urls:[base]});
      const access=cookies.find(c=>c.name.endsWith("gethired-access") || c.name.endsWith("gethired-dev-access"));
      assert.ok(access,"Expected access cookie");
      await call("Network.deleteCookies",{name:access.name,url:base});
      await navigation(role,`missing access recovery ${i+1}`);
      assert.ok((await call("Network.getCookies",{urls:[base]})).cookies.some(c=>c.name===access.name),"Access cookie restored");
    }
    // Revoke only the test session created by this run.
    await evaluate(`(async()=>{const c=await (await fetch('/api/auth/csrf',{cache:'no-store'})).json();const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':c.data.csrfToken},body:'{}'});return r.status})()`);
  }
} catch(error) {
  results.failure = error.message;
  process.exitCode = 1;
  console.error(error.message);
} finally {
  await mkdir("docs/performance",{recursive:true});
  const output = process.env.PERF_OUTPUT ?? `docs/performance/${navigationOnly?"navigation":"endpoint"}-${Date.now()}.json`;
  await writeFile(output,JSON.stringify(results,null,2)+"\n");
  ws?.close(); chrome.kill();
}
