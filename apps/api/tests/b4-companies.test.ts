import assert from "node:assert/strict"
import { test } from "node:test"
import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"
import sharp from "sharp"
import { companyInput, companyQuery } from "../src/modules/companies/validation.js"
import { createCompanyRepository } from "../src/modules/companies/repository.js"
import { cleanCompanyImages } from "../src/modules/companies/cleanup.js"
import { parseImage, sanitizeImage, uploadImage, imageStorage } from "../src/modules/companies/images.js"
import { createAuthStore, type SqlClient, type SqlPool } from "../src/auth/store.js"
import type { Principal } from "../src/auth/types.js"
import { COMPANY_IMAGE_MAX_BYTES } from "@gethired/contracts"
import express from "express"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { incomingUploadStream } from "../src/http/transport.js"
import { ApiError } from "../src/api/errors.js"

const input = { name: "Example Partner", industry: "Software Development", type: "Services", specializations: ["Web Development"],
  location: "Cebu City", slots: 0, description: "Internships", website: "example.test", email: "team@example.test", phone: "", hours: "" }
const query = (value = "", admin = false, bookmarks = false) => companyQuery(new URLSearchParams(value), admin, bookmarks)

test("company validation rejects mass assignment, unsafe links and ambiguous filters", () => {
  assert.equal(companyInput(input).slots, 0)
  assert.equal(companyInput(input).website, "https://example.test/")
  for (const extra of [{ saved: true }, { id: randomUUID() }, { image: "https://evil.test/asset" }, { slots: -1 }, { slots: 1.2 }, { slots: 100001 },
    { website: "javascript:alert(1)" }, { specializations: ["Unknown"] }, { email: "broken" }, { imageId: "123" }])
    assert.throws(() => companyInput({ ...input, ...extra }), { code: "VALIDATION_ERROR" })
  assert.throws(() => companyInput({}, true), { code: "VALIDATION_ERROR" })
  for (const value of ["page=0", "q=a&q=b", "niche=unknown", "status=inactive", "specialization=unknown", "ownerId=123", "pageSize=101"])
    assert.throws(() => query(value), { code: "VALIDATION_ERROR" })
  assert.throws(() => query("q=a", false, true), { code: "VALIDATION_ERROR" })
  assert.equal(query("status=inactive", true).status, "inactive")
})

test("Storage adapter uses bounded server-only upload and bucket deletion requests", async () => {
  const oldUrl = process.env.SUPABASE_URL, oldKey = process.env.SUPABASE_STORAGE_SECRET_KEY
  process.env.SUPABASE_URL = "https://example.supabase.co"
  process.env.SUPABASE_STORAGE_SECRET_KEY = "sb_secret_test"
  try {
    const path = `${randomUUID()}.webp`
    const requests: Request[] = []
    const storage = imageStorage(async (url, init) => { requests.push(new Request(url, init)); return Response.json([]) })
    await storage.put(path, Buffer.from("image")); await storage.remove(path)
    assert.equal(requests[0].url, `https://example.supabase.co/storage/v1/object/company-images/${path}`)
    assert.equal(requests[0].headers.get("apikey"), "sb_secret_test")
    assert.equal(requests[0].headers.get("authorization"), null)
    assert.equal(requests[1].url, "https://example.supabase.co/storage/v1/object/company-images")
    assert.deepEqual(await requests[1].json(), { prefixes: [path] })
    assert.equal(requests[1].redirect, "error")
    assert.throws(() => storage.remove("../other"), { code: "VALIDATION_ERROR" })
    await assert.rejects(imageStorage(async () => new Response("secret", { status: 500 })).put(path, Buffer.from("x")), { code: "SERVICE_UNAVAILABLE" })
  } finally {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl
    if (oldKey === undefined) delete process.env.SUPABASE_STORAGE_SECRET_KEY; else process.env.SUPABASE_STORAGE_SECRET_KEY = oldKey
  }
})

test("multipart streams enforce file count, actual byte limits, format, dimensions and metadata removal", async () => {
  const png = await sharp({ create: { width: 50, height: 25, channels: 3, background: "red" } }).png().withMetadata().toBuffer()
  const request = (form: FormData) => new Request("http://localhost/api/admin/company-images", { method: "POST", body: form })
  const form = (bytes = png, mime = "image/png") => { const data = new FormData(); data.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), "untrusted.png"); return data }
  const sanitized = await parseImage(request(form()))
  const metadata = await sharp(sanitized).metadata()
  assert.equal(metadata.format, "webp"); assert.equal(metadata.width, 50); assert.equal(metadata.exif, undefined); assert.equal(metadata.icc, undefined)
  const two = form(); two.append("file", new Blob([new Uint8Array(png)], { type: "image/png" }), "second.png")
  const field = form(); field.append("ownerId", randomUUID())
  for (const data of [two, field, new FormData(), form(Buffer.from("not an image")), form(png, "image/jpeg")])
    await assert.rejects(parseImage(request(data)), { code: "VALIDATION_ERROR" })
  await assert.rejects(parseImage(request(form(Buffer.alloc(COMPANY_IMAGE_MAX_BYTES + 1)))), { code: "PAYLOAD_TOO_LARGE" })
  const huge = await sharp({ create: { width: 4097, height: 1, channels: 3, background: "red" } }).png().toBuffer()
  await assert.rejects(sanitizeImage(huge, "image/png"), { code: "VALIDATION_ERROR" })
  await assert.rejects(sanitizeImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>'), "image/png"), { code: "VALIDATION_ERROR" })
  const jpeg = await sharp(png).jpeg().toBuffer(), webp = await sharp(png).webp().toBuffer()
  for (const [bytes, mime] of [[jpeg, "image/jpeg"], [webp, "image/webp"]] as const) assert.ok((await sanitizeImage(bytes, mime)).length)
})

test("oversized chunked multipart gets JSON 413 without destroying the response socket", async () => {
  const app = express()
  app.use(async (request, response) => {
    const web = new Request("http://localhost/upload", { method: "POST", headers: { "content-type": request.headers["content-type"]! },
      body: incomingUploadStream(request, response), duplex: "half" } as RequestInit)
    try { await parseImage(web); response.json({ ok: true }) }
    catch (error) { response.status(error instanceof ApiError ? error.status : 500).json({ error: error instanceof ApiError ? error.code : "INTERNAL_ERROR" }) }
  })
  const server = createServer(app)
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve))
  try {
    const data = new FormData(); data.append("file", new Blob([new Uint8Array(COMPANY_IMAGE_MAX_BYTES + 50000)], { type: "image/png" }), "large.png")
    const encoded = new Request("http://localhost", { method: "POST", body: data })
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, {
      method: "POST", body: encoded.body, headers: { "content-type": encoded.headers.get("content-type")! }, duplex: "half",
    } as RequestInit)
    assert.equal(response.status, 413)
    assert.deepEqual(await response.json(), { error: "PAYLOAD_TOO_LARGE" })
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
})

test("Storage setup denies browser writes even with an existing broad permissive policy", async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create schema storage;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid primary key, bucket_id text);
      alter table storage.objects enable row level security;
      grant usage on schema storage to anon, authenticated;
      grant select, insert, update, delete on storage.objects to anon, authenticated;
      create policy broad_policy on storage.objects for all to anon, authenticated using (true) with check (true);`)
    const script = await readFile(new URL("../../../supabase/company-image-storage.sql", import.meta.url), "utf8")
    await db.exec(script); await db.exec(script)
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`)
      await assert.rejects(db.query("insert into storage.objects values ($1,'company-images')", [randomUUID()]))
      await db.query("insert into storage.objects values ($1,'unrelated-bucket')", [randomUUID()])
      await db.exec("reset role")
    }
  } finally { await db.close() }
})

test("B4 persists companies and private bookmarks, audits atomically and retries orphan cleanup", async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, email_confirmed_at timestamptz, banned_until timestamptz);
      create table auth.sessions(id uuid primary key, user_id uuid references auth.users(id), not_after timestamptz);
      create table auth.refresh_tokens(session_id uuid references auth.sessions(id) on delete cascade, revoked boolean);`)
    for (const name of ["202609290001_phase3_auth.sql", "202610050001_b2_operations.sql", "202610120001_b3_feature_foundation.sql", "202610120002_b4_companies.sql"])
      await db.exec(await readFile(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8"))
    await db.exec("alter table gethired_private.accounts add column credentials_blocked boolean not null default false; alter table gethired_private.accounts add column credential_version integer not null default 0")
    const client = { query: async (sql: string, values?: unknown[]) => { const result = await db.query(sql, values); return { rows: result.rows, rowCount: result.affectedRows ?? 0 } }, release() {} } as SqlClient
    const pool: SqlPool = { connect: async () => client }
    const actor = async (role: "student" | "admin"): Promise<Principal> => {
      const authId = randomUUID(), id = randomUUID(), sessionId = randomUUID()
      await db.exec("reset role")
      await db.query("insert into auth.users values ($1, now(), null)", [authId])
      await db.query("insert into auth.sessions values ($1,$2,null)", [sessionId, authId])
      await db.query("insert into auth.refresh_tokens values ($1,false)", [sessionId])
      await db.query("insert into gethired_private.accounts(id,auth_user_id,email,display_name,role,status) values ($1,$2,$3,'Test',$4,'active')", [id, authId, `${id}@example.test`, role])
      if (role === "student") await db.query("insert into gethired_private.student_profiles(account_id,student_number,first_name,last_name,course,year_level) values ($1,$2,'Test','Student','BS IT','4th Year')", [id, id.replace(/\D/g, "").slice(0,8).padEnd(8,"0")])
      await db.exec("set role gethired_runtime")
      return createAuthStore(pool).createSession({ userId: authId, sessionId }, false)
    }
    const admin = await actor("admin"), student = await actor("student"), other = await actor("student")
    const repo = createCompanyRepository(pool)
    const company = await repo.save(admin, randomUUID(), companyInput(input))
    assert.equal(company.slots, 0); assert.equal(company.status, "active"); assert.ok(!("saved" in company))
    await assert.rejects(repo.save(student, randomUUID(), companyInput(input)), { code: "FORBIDDEN" })
    await assert.rejects(repo.bookmark(admin, company.id), { code: "FORBIDDEN" })
    await assert.rejects(repo.list(admin, query(), false, true), { code: "FORBIDDEN" })
    assert.equal((await repo.list(student, query("q=cebu&niche=Web+Development&specialization=Web+Development"))).meta.total, 1)
    assert.equal((await repo.list(student, query("q=%25"))).meta.total, 0)
    assert.equal((await repo.list(student, query("page=2&pageSize=1"))).data.length, 0)
    assert.equal((await repo.list(student, query("page=2&pageSize=1"))).meta.total, 1)
    const saved = await repo.bookmark(student, company.id)
    assert.deepEqual(await repo.bookmark(student, company.id), saved)
    assert.equal((await repo.list(other, query(), false, true)).meta.total, 0)
    assert.equal((await repo.list(student, query(), false, true)).meta.total, 1)
    await repo.save(admin, randomUUID(), { status: "inactive" }, company.id)
    await assert.rejects(repo.get(student, company.id), { code: "NOT_FOUND" })
    await assert.rejects(repo.bookmark(other, company.id), { code: "NOT_FOUND" })
    assert.equal((await repo.list(student, query(), false, true)).meta.total, 0)
    assert.equal((await repo.list(admin, query("status=inactive", true), true)).meta.total, 1)
    await repo.save(admin, randomUUID(), { status: "active", name: "Updated partner" }, company.id)
    assert.equal((await createCompanyRepository(pool).get(student, company.id)).name, "Updated partner")
    assert.equal((await repo.list(student, query(), false, true)).meta.total, 1)
    await repo.bookmark(other, company.id, true)
    assert.equal((await repo.list(student, query(), false, true)).meta.total, 1)
    await repo.bookmark(student, company.id, true); await repo.bookmark(student, company.id, true)
    assert.equal((await repo.list(student, query(), false, true)).meta.total, 0)
    await db.exec("reset role; revoke insert on gethired_private.audit_events from gethired_runtime; set role gethired_runtime")
    await assert.rejects(repo.save(admin, randomUUID(), { name: "Must roll back" }, company.id), { code: "SERVICE_UNAVAILABLE" })
    assert.equal((await repo.get(student, company.id)).name, "Updated partner")
    await db.exec("reset role; grant insert (actor_id, request_id, action, resource_type, resource_id) on gethired_private.audit_events to gethired_runtime; set role gethired_runtime")
    await assert.rejects(repo.save(admin, randomUUID(), { imageId: randomUUID() }, company.id), { code: "VALIDATION_ERROR" })
    const storage = { url: (path: string) => `https://example.test/${path}`, put: async () => {}, remove: async () => {} }
    const image = await uploadImage(pool, admin, randomUUID(), Buffer.from("sanitized"), storage)
    await repo.save(admin, randomUUID(), { imageId: image.imageId }, company.id)
    assert.equal((await repo.get(student, company.id)).image, image.url)
    await uploadImage(pool, admin, randomUUID(), Buffer.from("sanitized"), storage)
    await assert.rejects(uploadImage(pool, admin, randomUUID(), Buffer.from("sanitized"), { ...storage, put: async () => { throw new Error("Storage offline") } }))
    await db.exec("reset role; update gethired_private.company_images set created_at=now()-interval '2 days'; set role gethired_maintenance")
    assert.deepEqual(await cleanCompanyImages(pool, { remove: async () => { throw new Error("Retry") } }), { cleaned: 0, failed: 2 })
    await db.exec("reset role; set role gethired_runtime")
    const deleting = (await db.query<{ id: string }>("select id from gethired_private.company_images where state='deleting' limit 1")).rows[0].id
    await assert.rejects(repo.save(admin, randomUUID(), { imageId: deleting }, company.id), { code: "VALIDATION_ERROR" })
    await db.exec("reset role; set role gethired_maintenance")
    assert.deepEqual(await cleanCompanyImages(pool, storage), { cleaned: 2, failed: 0 })
    assert.equal((await db.query("select id from gethired_private.company_images")).rows.length, 1)
    await db.exec("reset role; set role anon")
    for (const table of ["companies", "company_images", "bookmarks"]) await assert.rejects(db.query(`select * from gethired_private.${table}`))
  } finally { await db.close() }
})
