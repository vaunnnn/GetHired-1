import type { Request as ExpressRequest, Response as ExpressResponse } from "express"
import { ApiError } from "../api/errors.js"

/** Cancellation discards remaining bytes without resetting an in-flight JSON response. */
export function incomingUploadStream(request: ExpressRequest, response: ExpressResponse): ReadableStream<Uint8Array> {
  let ended = false
  let cleanup = () => {}
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const data = (chunk: Buffer) => { controller.enqueue(chunk); if ((controller.desiredSize ?? 0) <= 0) request.pause() }
      const end = () => { ended = true; cleanup(); controller.close() }
      const error = () => { ended = true; cleanup(); controller.error(new ApiError("VALIDATION_ERROR")) }
      cleanup = () => { request.off("data", data); request.off("end", end); request.off("error", error); request.off("aborted", error) }
      request.on("data", data); request.once("end", end); request.once("error", error); request.once("aborted", error)
      request.pause()
    },
    pull() { if (!ended) request.resume() },
    cancel() {
      ended = true; cleanup()
      // Drain without buffering so a client still transmitting can receive the error.
      // Bound this discard phase; never leave a stalled upload attached indefinitely.
      const deadline = setTimeout(() => request.destroy(), 5000)
      deadline.unref()
      request.once("end", () => clearTimeout(deadline))
      request.once("close", () => clearTimeout(deadline))
      request.resume()
    },
  })
}

/** Buffer the small JSON contract; image routes pass their bounded stream to Busboy. */
export async function readIncomingBody(
  request: ExpressRequest,
  response: ExpressResponse,
  limit: number,
  timeoutMs: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const length = request.headers["content-length"]
  if (length && Number(length) > limit) {
    response.shouldKeepAlive = false
    throw new ApiError("PAYLOAD_TOO_LARGE")
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    const timer = setTimeout(() => fail(new ApiError("SERVICE_UNAVAILABLE")), timeoutMs)
    const cleanup = () => {
      clearTimeout(timer)
      request.off("data", data)
      request.off("end", end)
      request.off("error", failed)
      request.off("aborted", failed)
    }
    const fail = (error: ApiError) => {
      cleanup()
      request.pause()
      response.shouldKeepAlive = false
      reject(error)
    }
    const failed = () => fail(new ApiError("INVALID_JSON"))
    const data = (chunk: Buffer) => {
      size += chunk.length
      if (size > limit) return fail(new ApiError("PAYLOAD_TOO_LARGE"))
      chunks.push(chunk)
    }
    const end = () => {
      cleanup()
      resolve(new Uint8Array(Buffer.concat(chunks, size)))
    }
    request.on("data", data)
    request.once("end", end)
    request.once("error", failed)
    request.once("aborted", failed)
  })
}

export async function sendWebResponse(response: Response, target: ExpressResponse) {
  target.statusCode = response.status
  response.headers.forEach((value, name) => {
    if (name !== "set-cookie") target.setHeader(name, value)
  })
  const cookies = response.headers.getSetCookie()
  if (cookies.length) target.setHeader("Set-Cookie", cookies)
  target.end(Buffer.from(await response.arrayBuffer()))
}
