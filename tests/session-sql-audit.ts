// Real auth-store queries against the same isolated PostgreSQL fixture as auth-phase3.test.ts.
// Injected query latency is a sensitivity model, never a production measurement.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { PGlite } from "@electric-sql/pglite";
import { createAuthStore, type SqlPool } from "../apps/api/src/auth/store.js";
import { createCompanyRepository } from "../apps/api/src/modules/companies/repository.js";
import { createApiRoute } from "../apps/api/src/api/route.js";
import { companyQuery } from "../apps/api/src/modules/companies/validation.js";
import { requestTiming, safeTimings, type Timings } from "../apps/api/src/logging/timing.js";

const db = new PGlite();
const reports: unknown[] = [];
let latency = 0, statements: string[] = [];
try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, email_confirmed_at timestamptz, banned_until timestamptz);
    create table auth.sessions(id uuid primary key, user_id uuid not null references auth.users(id), not_after timestamptz);
    create table auth.refresh_tokens(id bigint generated always as identity primary key, session_id uuid references auth.sessions(id) on delete cascade, revoked boolean not null default false);`);
  await db.exec(await readFile("supabase/migrations/202609290001_phase3_auth.sql", "utf8"));
  for (const name of ["202610050001_b2_operations.sql", "202610120001_b3_feature_foundation.sql", "202610120002_b4_companies.sql"])
    await db.exec(await readFile(`supabase/migrations/${name}`,"utf8"));
  await db.exec("alter table gethired_private.accounts add column credentials_blocked boolean not null default false; alter table gethired_private.accounts add column credential_version integer not null default 0");
  await db.exec(await readFile("supabase/migrations/202610260001_session_authorization.sql", "utf8"));
  const userId = randomUUID(), accountId = randomUUID(), sessionId = randomUUID();
  await db.query("insert into auth.users(id,email_confirmed_at) values ($1,now())",[userId]);
  await db.query("insert into auth.sessions values ($1,$2,null)",[sessionId,userId]);
  await db.query("insert into auth.refresh_tokens(session_id) values ($1)",[sessionId]);
  await db.query("insert into gethired_private.accounts(id,auth_user_id,email,display_name,role,status) values ($1,$2,'audit@example.test','Audit','admin','active')",[accountId,userId]);
  const pool: SqlPool = { async connect() { return {
    async query(sql, values) {
      statements.push(sql.replace(/\s+/g," ").trim());
      if (latency) await delay(latency);
      const result = await db.query(sql,values);
      if(sql === "begin") await db.exec("set local role gethired_runtime");
      return {rows:result.rows as never[],rowCount:result.affectedRows??null};
    },release() {},
  }; }};
  const store = createAuthStore(pool);
  await store.createSession({userId,sessionId},false);
  for (latency of [0,25,75]) {
    for(const touch of [false,true]) {
      for(let sample=0;sample<5;sample++) {
        statements=[];
        const start=performance.now();
        let timings;
        const actor=await requestTiming(async context => {
          const actor = touch ? await store.withSession(sessionId,{userId,sessionId},true,async principal=>principal) : await store.readSession(sessionId,{userId,sessionId});
          timings = safeTimings(context.timings);
          assert.equal((timings.db_control?.count ?? 0) + (timings.db_lock?.count ?? 0) + (timings.db_auth?.count ?? 0), touch ? 5 : 4);
          return actor;
        });
        assert.equal(actor.id,accountId);
        assert.equal(statements.length,touch?5:4);
        reports.push({injectedLatencyPerQueryMs:latency,touch,sample:sample+1,durationMs:Math.round(performance.now()-start),statementCount:statements.length,timings,statements:[...statements]});
      }
    }
  }
  const repository=createCompanyRepository(pool);
  let routeTimings: Timings | undefined;
  const route = createApiRoute({ route: "/api/admin/companies", access: { kind: "protected", permission: "companies:write", transaction: "business" }, methods: {
    GET: { body: "none", handle: c => repository.list(c.actor!.auth!,companyQuery(new URLSearchParams(),true),true,false,c.authorization) }
  } }, { config: () => ({ appOrigin: "http://localhost", maxBodyBytes: 65536, logDestination: "stdout" }), logger(entry) { routeTimings = entry.timings },
    withAuthorization: (_request, permission, work) => store.withAuthorization(sessionId,{userId,sessionId},permission,work) });
  for(latency of [0,25,75]) {
    for(let sample=0;sample<5;sample++) {
      statements=[];
      const start=performance.now();
      let timings;
      const result=await requestTiming(async context => {
        const response = await route.GET(new Request("http://localhost/api/admin/companies"));
        assert.equal(response.status,200);
        const result = await response.json();
        timings = safeTimings(routeTimings ?? {});
        assert.equal(timings.authorized?.count, 1);
        assert.equal(timings.session_store, undefined);
        assert.equal(timings.db_business?.count, 1);
        assert.equal((timings.db_control?.count ?? 0) + (timings.db_lock?.count ?? 0) + (timings.db_auth?.count ?? 0) + (timings.db_business?.count ?? 0), 6);
        return result;
      });
      assert.equal(result.meta.total,0);
      assert.equal(statements.length,6);
      assert.equal(statements.filter(sql=>sql === "begin").length,1);
      reports.push({scenario:"authentication plus real company list repository",injectedLatencyPerQueryMs:latency,sample:sample+1,durationMs:Math.round(performance.now()-start),statementCount:statements.length,timings,statements:[...statements]});
    }
  }
  await db.query("update gethired_private.sessions set revoked_at=now() where id=$1",[sessionId]);
  await assert.rejects(store.withSession(sessionId,{userId,sessionId},false,async p=>p),{code:"SESSION_EXPIRED"});
  console.log("SQL audit passed: 45 measured runs; 4 statements per session read, 5 per activity update, 6 per authenticated company list; revoked session rejected.");
  await mkdir("docs/performance",{recursive:true});
  await writeFile(process.env.PERF_SQL_OUTPUT ?? `docs/performance/phase2-sql-${Date.now()}.json`,JSON.stringify({timestamp:new Date().toISOString(),database:"PGlite; single connection; not production PostgreSQL latency or concurrency",node:process.version,reports},null,2)+"\n");
} finally {await db.close();}
