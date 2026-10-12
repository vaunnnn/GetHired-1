import { ApiError } from "./errors.js"

export type BodyFormat = "none" | "json" | "image"

/** Count actual streamed bytes; Content-Length is only an early rejection hint. */
export async function readLimitedBody(
  request: Request,
  limit: number,
): Promise<Uint8Array> {
  const length = request.headers.get("Content-Length")
  if (length && /^\d+$/.test(length) && Number(length) > limit) {
    void request.body?.cancel().catch(() => {})
    throw new ApiError("PAYLOAD_TOO_LARGE")
  }
  if (!request.body) return new Uint8Array()
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) {
        void reader.cancel().catch(() => {})
        throw new ApiError("PAYLOAD_TOO_LARGE")
      }
      chunks.push(value)
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError("INVALID_JSON")
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

export function parseBody(
  request: Request,
  bytes: Uint8Array,
  format: BodyFormat,
): unknown {
  if (format === "none") {
    if (bytes.byteLength)
      throw new ApiError("VALIDATION_ERROR", {
        fieldErrors: {
          body: ["This endpoint does not accept a request body."],
        },
      })
    return undefined
  }
  const mediaType = request.headers
    .get("Content-Type")
    ?.split(";")[0]
    .trim()
    .toLowerCase()
  const encoding = request.headers.get("Content-Encoding")
  if (
    mediaType !== "application/json" ||
    (encoding && encoding.toLowerCase() !== "identity")
  ) {
    throw new ApiError("UNSUPPORTED_MEDIA_TYPE")
  }
  let body: unknown
  try {
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
  } catch {
    throw new ApiError("INVALID_JSON")
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError("VALIDATION_ERROR", {
      fieldErrors: { body: ["Send a JSON object."] },
    })
  }
  return body
}
