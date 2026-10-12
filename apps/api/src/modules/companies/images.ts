import busboy from "busboy"
import sharp from "sharp"
import { randomUUID } from "node:crypto"
import { COMPANY_IMAGE_MAX_BYTES, COMPANY_MULTIPART_MAX_BYTES } from "@gethired/contracts"
import { ApiError } from "../../api/errors.js"
import type { SqlPool } from "../../auth/store.js"
import type { Principal } from "../../auth/types.js"
import { authorizedTransaction } from "../../db/transaction.js"
import { appendAudit } from "../../db/events.js"

export async function parseImage(request: Request): Promise<Buffer> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;") ||
    request.headers.has("content-encoding") && request.headers.get("content-encoding") !== "identity") throw new ApiError("UNSUPPORTED_MEDIA_TYPE")
  if (Number(request.headers.get("content-length")) > COMPANY_MULTIPART_MAX_BYTES) throw new ApiError("PAYLOAD_TOO_LARGE")
  if (!request.body) throw new ApiError("VALIDATION_ERROR")
  let parser: ReturnType<typeof busboy>
  try { parser = busboy({ headers: { "content-type": request.headers.get("content-type")! }, limits: { files: 1, fields: 0, parts: 2, fileSize: COMPANY_IMAGE_MAX_BYTES + 1, headerPairs: 32 } }) }
  catch { throw new ApiError("VALIDATION_ERROR") }
  const chunks: Buffer[] = []
  let failure: ApiError | undefined, count = 0, fileBytes = 0, mime = ""
  const fail = (code: "VALIDATION_ERROR" | "PAYLOAD_TOO_LARGE" = "VALIDATION_ERROR") => { failure ??= new ApiError(code) }
  parser.on("file", (name, file, info) => {
    count++; mime = info.mimeType
    if (name !== "file" || !["image/jpeg", "image/png", "image/webp"].includes(mime)) fail()
    file.on("limit", () => fail("PAYLOAD_TOO_LARGE"))
    file.on("error", () => fail())
    file.on("data", (chunk: Buffer) => { fileBytes += chunk.length; if (!failure) chunks.push(chunk) })
  })
  for (const event of ["fieldsLimit", "filesLimit", "partsLimit"] as const) parser.on(event, () => fail())
  const finished = new Promise<void>(resolve => {
    parser.on("error", () => { fail(); resolve() })
    parser.on("close", resolve)
  })
  const reader = request.body.getReader()
  let size = 0
  const timer = setTimeout(() => { fail(); void reader.cancel().catch(() => {}); parser.destroy() }, 15000)
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > COMPANY_MULTIPART_MAX_BYTES) fail("PAYLOAD_TOO_LARGE")
      if (failure) { void reader.cancel().catch(() => {}); break }
      parser.write(value)
    }
    parser.end()
    await finished
    if (size - fileBytes > 16 * 1024) fail("PAYLOAD_TOO_LARGE")
    if (failure) throw failure
    if (count !== 1) throw new ApiError("VALIDATION_ERROR")
    return await sanitizeImage(Buffer.concat(chunks), mime)
  } catch (error) { throw error instanceof ApiError ? error : new ApiError("VALIDATION_ERROR") }
  finally { clearTimeout(timer); parser.destroy(); reader.releaseLock() }
}
export async function sanitizeImage(bytes: Buffer, mime: string): Promise<Buffer> {
  if (bytes.length > COMPANY_IMAGE_MAX_BYTES) throw new ApiError("PAYLOAD_TOO_LARGE")
  try {
    const image = sharp(bytes, { limitInputPixels: 4096 * 4096, failOn: "warning" })
    const info = await image.metadata()
    if (!info.width || !info.height || info.width > 4096 || info.height > 4096 || (info.pages ?? 1) > 1 ||
      !["jpeg", "png", "webp"].includes(info.format ?? "") || `image/${info.format}` !== mime) throw new Error("Invalid image")
    // Sharp removes metadata by default; decode all pixels and normalize to WebP.
    const output = await image.rotate().webp({ quality: 85 }).timeout({ seconds: 10 }).toBuffer()
    if (output.length > COMPANY_IMAGE_MAX_BYTES) throw new Error("Image too large after normalization")
    return output
  } catch { throw new ApiError("VALIDATION_ERROR", { fieldErrors: { file: ["Use a valid JPEG, PNG or WebP image, at most 4096 pixels per side."] } }) }
}
export function imageStorage(fetcher: typeof fetch = fetch) {
  let base: URL
  try { base = new URL(process.env.SUPABASE_URL ?? "") } catch { throw new ApiError("SERVICE_UNAVAILABLE") }
  const secret = process.env.SUPABASE_STORAGE_SECRET_KEY
  const bucket = process.env.COMPANY_IMAGE_BUCKET ?? "company-images"
  if (base.protocol !== "https:" || base.pathname !== "/" || base.search || base.hash || base.username || !secret || !/^[a-z0-9-]{1,63}$/.test(bucket)) throw new ApiError("SERVICE_UNAVAILABLE")
  const objectUrl = (path: string) => {
    if (!/^[0-9a-f-]{36}\.webp$/.test(path)) throw new ApiError("VALIDATION_ERROR")
    return `${base.origin}/storage/v1/object/${bucket}/${path}`
  }
  const send = async (url: string, method: string, body: Uint8Array | string, contentType: string) => {
    try {
      const response = await fetcher(url, { method, headers: { apikey: secret, ...(secret.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${secret}` }), "Content-Type": contentType, "x-upsert": "false" },
        body: typeof body === "string" ? body : new Uint8Array(body), signal: AbortSignal.timeout(15000), redirect: "error" })
      await response.body?.cancel()
      if (!response.ok) throw new Error("Storage failure")
    } catch { throw new ApiError("SERVICE_UNAVAILABLE") }
  }
  return { url: (path: string) => objectUrl(path).replace("/object/", "/object/public/"),
    put: (path: string, body: Buffer) => send(objectUrl(path), "POST", body, "image/webp"),
    remove: (path: string) => { objectUrl(path); return send(`${base.origin}/storage/v1/object/${bucket}`, "DELETE", JSON.stringify({ prefixes: [path] }), "application/json") } }
}
export async function uploadImage(pool: SqlPool, actor: Principal, requestId: string, bytes: Buffer, storage = imageStorage()) {
  const imageId = randomUUID(), path = `${imageId}.webp`, url = storage.url(path)
  // Reserve before external work so failures/timeouts/crashes remain discoverable.
  await authorizedTransaction(pool, actor, "companies:write", async client => {
    await client.query("insert into gethired_private.company_images(id,object_path,url) values ($1,$2,$3)", [imageId, path, url])
  })
  await storage.put(path, bytes)
  await authorizedTransaction(pool, actor, "companies:write", async client => {
    const updated = await client.query("update gethired_private.company_images set state='ready' where id=$1 and state='pending' returning id", [imageId])
    if (!updated.rows.length) throw new ApiError("CONFLICT")
    await appendAudit(client, { actorId: actor.id, requestId, action: "company_image.created", resourceType: "company_image", resourceId: imageId })
  })
  return { imageId, url }
}
