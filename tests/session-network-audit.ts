// Runs the production client over real HTTP against the local Postman simulation.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createApiClient } from "../src/lib/api-client.js";
const base=process.env.SESSION_SIM_URL??"http://127.0.0.1:4510/session";
const reports=[];
function mutex(){let tail=Promise.resolve();return <T>(work:()=>Promise<T>)=>{const next=tail.then(work);tail=next.then(()=>{},()=>{});return next;};}
for(const scenario of ["refresh","me after expiry","three concurrent mutations","me outage"]){
  await fetch(`${base}/control/reset?mode=${scenario.includes("mutations")?"current":scenario.includes("outage")?"outage":"expired"}`,{method:"POST"});
  let version: string | null = null;
  const client=createApiClient({bindingVersion:{read:()=>version,write:next=>{version=next;}},sharedLock:work=>work(),fetcher:(input,init)=>fetch(`${base}${input}`,init),lock:mutex(),notify(){}});
  const start=performance.now();
  if(scenario==="refresh") await client.refresh();
  else if(scenario==="me after expiry") await client.me();
  else if(scenario.includes("mutations")) await Promise.all(Array.from({length:3},()=>client.mutate("/api/admin/companies","PATCH",{})));
  else await assert.rejects(client.me(),{status:503});
  const durationMs=Math.round(performance.now()-start);
  const trace=(await(await fetch(`${base}/control/trace`)).json()).data;
  assert.equal(trace.length,scenario==="refresh"?3:scenario.includes("outage")?2:scenario.includes("mutations")?4:4);
  if (scenario.includes("mutations")) {
    const writes = trace.filter((entry: { method: string }) => entry.method === "PATCH");
    assert.equal(writes.length,3);
    assert.ok(Math.max(...writes.map((entry: { start: number })=>entry.start)) - Math.min(...writes.map((entry: { start: number })=>entry.start)) < 75, "writes should overlap the fixture's 75ms response delay");
  }
  reports.push({scenario,durationMs,requestCount:trace.length,trace});
  console.log(`${scenario}: ${durationMs}ms, ${trace.length} HTTP requests`);
}
await mkdir("docs/performance",{recursive:true});
await writeFile("docs/performance/phase4-network-audit.json",JSON.stringify({timestamp:new Date().toISOString(),injectedDelayPerRequestMs:75,reports},null,2)+"\n");
