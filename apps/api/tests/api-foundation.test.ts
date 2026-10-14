import assert from "node:assert/strict"
import { test } from "node:test"
import { readServerConfig, MAX_JSON_BODY_BYTES } from "../src/config.js"
import {
  ApiError,
  API_ERRORS,
  type ApiErrorCode,
} from "../src/api/errors.js"
import { createApiRoute as createBaseApiRoute, HTTP_METHODS } from "../src/api/route.js"
import type { ApiResult } from "../src/api/responses.js"
import { logRequest, type RequestLog } from "../src/logging/request.js"

const config = () => readServerConfig({ APP_ORIGIN: "http://localhost:3000" })
const silent = () => {}
// Foundation unit tests isolate response/body behavior; Phase 3 tests exercise CSRF.
const createApiRoute: typeof createBaseApiRoute = (definition, dependencies) =>
  createBaseApiRoute(definition, { enforceBrowserProtection: () => {}, ...dependencies })
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function route(handle: () => ApiResult | Promise<ApiResult>, logger = silent) {
  return createApiRoute(
    {
      route: "/api/example",
      access: { kind: "public" },
      methods: { GET: { body: "none", handle } },
    },
    { config, logger },
  )
}

function jsonRoute(maxBodyBytes = MAX_JSON_BODY_BYTES) {
  return createApiRoute(
    {
      route: "/api/example",
      access: { kind: "public" },
      methods: {
        POST: { body: "json", handle: ({ body }) => ({ data: body }) },
      },
    },
    { config: () => ({ ...config(), maxBodyBytes }), logger: silent },
  )
}

function post(
  body: string | ReadableStream<Uint8Array>,
  headers: Record<string, string> = {},
) {
  return new Request("http://localhost/api/example", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json", ...headers },
    ...(typeof body === "string" ? {} : { duplex: "half" }),
  } as RequestInit)
}

async function expectError(
  response: Response,
  status: number,
  code: ApiErrorCode,
) {
  assert.equal(response.status, status)
  assert.equal(response.headers.get("Cache-Control"), "private, no-store")
  assert.match(response.headers.get("Content-Type")!, /^application\/json/)
  const envelope = await response.json()
  assert.equal(envelope.error.code, code)
  assert.equal(envelope.requestId, response.headers.get("X-Request-ID"))
  assert.match(envelope.requestId, uuid)
  return envelope
}

test("success statuses, creation location, pagination, and fresh server request IDs", async () => {
  const responses = []
  for (const status of [200, 201, 202] as const) {
    const response = await route(() => ({
      data: [{ id: "example" }],
      status,
      meta: { page: 1, pageSize: 20, total: 1 },
      ...(status === 201 ? { location: "/api/example/example" } : {}),
      headers: {
        "Cache-Control": "public, max-age=3600",
        "X-Request-ID": "handler-id",
      },
    })).GET(
      new Request("http://localhost/api/example", {
        headers: { "X-Request-ID": "caller-id" },
      }),
    )
    assert.equal(response.status, status)
    assert.equal(response.headers.get("Cache-Control"), "private, no-store")
    assert.equal(
      response.headers.get("Location"),
      status === 201 ? "/api/example/example" : null,
    )
    const envelope = await response.json()
    assert.deepEqual(envelope.data, [{ id: "example" }])
    assert.deepEqual(envelope.meta, { page: 1, pageSize: 20, total: 1 })
    assert.match(envelope.requestId, uuid)
    assert.equal(envelope.requestId, response.headers.get("X-Request-ID"))
    responses.push(envelope.requestId)
  }
  assert.equal(new Set(responses).size, 3)
})

test("every Phase 1 error code has the contracted status and safe envelope", async () => {
  const expected: Record<ApiErrorCode, number> = {
    INVALID_JSON: 400,
    VALIDATION_ERROR: 400,
    INVALID_RECOVERY_CODE: 400,
    INVALID_VERIFICATION_CODE: 400,
    UNAUTHENTICATED: 401,
    SESSION_EXPIRED: 401,
    INVALID_CREDENTIALS: 401,
    FORBIDDEN: 403,
    CSRF_FAILED: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409,
    ATTEMPT_COMPLETED: 409,
    ATTEMPT_INCOMPLETE: 409,
    PAYLOAD_TOO_LARGE: 413,
    UNSUPPORTED_MEDIA_TYPE: 415,
    RATE_LIMITED: 429,
    INTERNAL_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
  }
  assert.deepEqual(Object.keys(API_ERRORS).sort(), Object.keys(expected).sort())
  for (const [code, status] of Object.entries(expected)) {
    const response = await route(() => {
      throw new ApiError(code as ApiErrorCode, {
        allow: ["GET"],
        retryAfter: 60,
        fieldErrors: { slots: ["Enter a whole number of zero or more."] },
      })
    }).GET(new Request("http://localhost/api/example"))
    if (code === "RATE_LIMITED")
      assert.equal(response.headers.get("Retry-After"), "60")
    if (code === "METHOD_NOT_ALLOWED")
      assert.equal(response.headers.get("Allow"), "GET")
    const envelope = await expectError(response, status, code as ApiErrorCode)
    assert.equal("fieldErrors" in envelope.error, code === "VALIDATION_ERROR")
  }
})

test("known routes return JSON 405 and Allow for unsupported methods, including OPTIONS", async () => {
  let called = false
  const handlers = route(() => {
    called = true
    return { data: {} }
  })
  for (const method of ["POST", "OPTIONS"] as const) {
    const response = await handlers[method](
      new Request("http://localhost/api/example", { method }),
    )
    assert.equal(response.headers.get("Allow"), "GET")
    await expectError(response, 405, "METHOD_NOT_ALLOWED")
  }
  assert.equal(called, false)
  const head = await handlers.HEAD(
    new Request("http://localhost/api/example", { method: "HEAD" }),
  )
  assert.equal(head.status, 405)
  assert.equal(head.headers.get("Allow"), "GET")
  assert.match(head.headers.get("X-Request-ID")!, uuid)
  assert.equal(await head.text(), "")
})

test("API root and unknown routes use the same fallback for all supported methods", async () => {
  const handlers = createApiRoute(
    { route: "/api/[[...path]]", access: { kind: "public" }, methods: {} },
    { config, logger: silent },
  )
  for (const method of HTTP_METHODS) {
    const response = await handlers[method](
      new Request("http://localhost/api/unknown?token=secret", { method }),
    )
    if (method === "HEAD") {
      assert.equal(response.status, 404)
      assert.equal(await response.text(), "")
    } else await expectError(response, 404, "NOT_FOUND")
  }
})

test("protected routes fail closed without an access implementation", async () => {
  let called = false
  const handlers = createApiRoute(
    {
      route: "/api/private",
      access: { kind: "protected", permission: "companies:read" },
      methods: {
        GET: {
          body: "none",
          handle: () => {
            called = true
            return { data: {} }
          },
        },
      },
    },
    { config, logger: silent },
  )
  await expectError(
    await handlers.GET(
      new Request("http://localhost/api/private", {
        headers: { Authorization: "Bearer unverified", Cookie: "role=admin" },
      }),
    ),
    503,
    "SERVICE_UNAVAILABLE",
  )
  assert.equal(called, false)
})

test("access denial precedes parsing and business work; a broken logger preserves denial", async () => {
  let called = false
  const handlers = createApiRoute(
    {
      route: "/api/private",
      access: { kind: "protected", permission: "session:read" },
      methods: {
        POST: {
          body: "json",
          handle: () => {
            called = true
            return { data: {} }
          },
        },
      },
    },
    {
      config,
      enforceAccess: async () => {
        throw new ApiError("FORBIDDEN")
      },
      logger: async () => {
        throw new Error("logging unavailable")
      },
    },
  )
  await expectError(await handlers.POST(post("bad JSON")), 403, "FORBIDDEN")
  assert.equal(called, false)
})

test("verified actor and async params reach the handler and only the actor ID enters the log", async () => {
  const actorId = "00000000-0000-4000-8000-000000000001"
  const entries: RequestLog[] = []
  const handlers = createApiRoute(
    {
      route: "/api/example/[id]",
      access: { kind: "protected", permission: "companies:read" },
      methods: {
        GET: {
          body: "none",
          handle: ({ params, actor }) => ({ data: { params, actor } }),
        },
      },
    },
    {
      config,
      logger: (entry) => {
        entries.push(entry)
      },
      enforceAccess: async (_request, policy) => {
        assert.equal(policy.permission, "companies:read")
        return { id: actorId }
      },
    },
  )
  const response = await handlers.GET(
    new Request("http://localhost/api/example/123"),
    { params: Promise.resolve({ id: "123" }) },
  )
  assert.deepEqual((await response.json()).data, {
    params: { id: "123" },
    actor: { id: actorId },
  })
  assert.equal(entries[0].actorId, actorId)
  assert.equal(entries[0].route, "/api/example/[id]")
})

test("missing or invalid access declarations are rejected", () => {
  assert.throws(
    () => createApiRoute({ route: "/api/example", methods: {} } as never),
    /access policy/,
  )
  assert.throws(
    () =>
      createApiRoute({
        route: "/api/example",
        access: { kind: "typo" },
        methods: {},
      } as never),
    /access policy/,
  )
})

test("JSON parsing accepts object bodies and rejects malformed, empty, scalar, and array bodies", async () => {
  const handlers = jsonRoute()
  assert.deepEqual(
    (await (await handlers.POST(post('{"answer":"hello"}'))).json()).data,
    { answer: "hello" },
  )
  for (const body of ["", "{", '{"bad":}']) {
    await expectError(await handlers.POST(post(body)), 400, "INVALID_JSON")
  }
  for (const body of ["null", "[]", "true", "1", '"text"']) {
    await expectError(await handlers.POST(post(body)), 400, "VALIDATION_ERROR")
  }
})

test("wrong content types, compressed bodies, and malformed UTF-8 are rejected", async () => {
  const handlers = jsonRoute()
  for (const type of [
    "text/plain",
    "multipart/form-data",
    "application/x-www-form-urlencoded",
  ]) {
    await expectError(
      await handlers.POST(post("{}", { "Content-Type": type })),
      415,
      "UNSUPPORTED_MEDIA_TYPE",
    )
  }
  await expectError(
    await handlers.POST(post("{}", { "Content-Encoding": "gzip" })),
    415,
    "UNSUPPORTED_MEDIA_TYPE",
  )
  const malformed = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([0xff]))
      controller.close()
    },
  })
  await expectError(await handlers.POST(post(malformed)), 400, "INVALID_JSON")
})

test("size limit uses actual bytes with missing/false Content-Length and accepts the exact boundary", async () => {
  const handlers = jsonRoute(12)
  const exact = '{"x":"éé"}' // 12 UTF-8 bytes, 10 characters.
  assert.equal(new TextEncoder().encode(exact).byteLength, 12)
  assert.equal((await handlers.POST(post(exact))).status, 200)
  await expectError(
    await handlers.POST(post('{"x":"ééé"}')),
    413,
    "PAYLOAD_TOO_LARGE",
  )
  await expectError(
    await handlers.POST(post('{"x":"ééé"}', { "Content-Length": "1" })),
    413,
    "PAYLOAD_TOO_LARGE",
  )
  await expectError(
    await handlers.POST(post("{}", { "Content-Length": "13" })),
    413,
    "PAYLOAD_TOO_LARGE",
  )
})

test("oversized streamed input is cancelled before the business handler runs", async () => {
  let cancelled = false
  const chunks = [new Uint8Array(8), new Uint8Array(8)]
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(chunks.shift() ?? new Uint8Array(1))
    },
    cancel() {
      cancelled = true
    },
  })
  await expectError(
    await jsonRoute(12).POST(post(stream)),
    413,
    "PAYLOAD_TOO_LARGE",
  )
  assert.equal(cancelled, true)
})

test("bodyless endpoints reject unexpected input", async () => {
  const handlers = createApiRoute(
    {
      route: "/api/example",
      access: { kind: "public" },
      methods: {
        DELETE: { body: "none", handle: () => ({ data: { removed: true } }) },
      },
    },
    { config, logger: silent },
  )
  await expectError(
    await handlers.DELETE(
      new Request("http://localhost/api/example", {
        method: "DELETE",
        body: "unexpected",
      }),
    ),
    400,
    "VALIDATION_ERROR",
  )
})

test("unknown errors and serialization failures return generic JSON 500", async () => {
  for (const handle of [
    () => {
      throw new Error("database password=secret, SQL diagnostics")
    },
    () => ({ data: BigInt(1) }),
    () => ({ data: undefined }),
    () => ({ data: {}, status: 204 }) as unknown as ApiResult,
  ]) {
    const envelope = await expectError(
      await route(handle).GET(new Request("http://localhost/api/example")),
      500,
      "INTERNAL_ERROR",
    )
    assert.equal(
      envelope.error.message,
      "Something went wrong. Try again later.",
    )
    assert.equal(JSON.stringify(envelope).includes("secret"), false)
  }
})

test("request logs correlate with the response and exclude credentials, URLs, bodies, and thrown errors", async () => {
  const entries: RequestLog[] = []
  const handlers = createApiRoute(
    {
      route: "/api/example/[id]",
      access: { kind: "public" },
      methods: {
        POST: {
          body: "json",
          handle: () => {
            throw new Error("secret-provider-diagnostic")
          },
        },
      },
    },
    {
      config,
      logger: (entry) => {
        entries.push(entry)
      },
    },
  )
  const response = await handlers.POST(
    new Request("http://localhost/api/example/secret-id?proof=secret-proof", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer secret-token",
        Cookie: "secret-cookie",
      },
      body: '{"password":"secret-password","email":"secret-email","answer":"secret-answer"}',
    }),
  )
  assert.equal(entries.length, 1)
  assert.equal(entries[0].requestId, response.headers.get("X-Request-ID"))
  assert.equal(entries[0].status, 500)
  assert.equal(entries[0].errorCode, "INTERNAL_ERROR")
  assert.ok(entries[0].durationMs >= 0)
  assert.equal(JSON.stringify(entries).includes("secret"), false)
})

test("stdout logger selects only approved fields", () => {
  const output: string[] = []
  const original = console.info
  console.info = (line: string) => {
    output.push(line)
  }
  try {
    logRequest({
      requestId: "id",
      route: "/api/example",
      method: "GET",
      status: 200,
      durationMs: 1,
      password: "secret",
      request: { headers: "secret" },
    } as RequestLog)
  } finally {
    console.info = original
  }
  assert.equal(output.length, 1)
  assert.equal(output[0].includes("secret"), false)
  assert.equal(JSON.parse(output[0]).event, "api.request.completed")
})

test("ordinary logging failures preserve successful responses", async () => {
  const response = await route(
    () => ({ data: { ok: true } }),
    () => {
      throw new Error("logger failed")
    },
  ).GET(new Request("http://localhost/api/example"))
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).data, { ok: true })
})

test("configuration validates origin, production HTTPS, limits, and log destination without exposing values", () => {
  assert.deepEqual(config(), {
    appOrigin: "http://localhost:3000",
    maxBodyBytes: 65536,
    logDestination: "stdout",
  })
  assert.equal(
    readServerConfig({
      APP_ORIGIN: "https://example.com/",
      NODE_ENV: "production",
    }).appOrigin,
    "https://example.com",
  )
  for (const env of [
    {},
    { APP_ORIGIN: "invalid-secret" },
    { APP_ORIGIN: "https://user:secret@example.com" },
    { APP_ORIGIN: "https://example.com/path" },
    { APP_ORIGIN: "https://example.com?secret=value" },
    { APP_ORIGIN: "http://example.com", NODE_ENV: "production" },
    ...["0", "65537", "NaN", "1.5", "-1", ""].map((limit) => ({
      APP_ORIGIN: "https://example.com",
      API_MAX_BODY_BYTES: limit,
    })),
    {
      APP_ORIGIN: "https://example.com",
      API_LOG_DESTINATION: "https://secret-collector",
    },
  ]) {
    assert.throws(
      () => readServerConfig(env as NodeJS.ProcessEnv),
      (error: Error) => !error.message.includes("secret"),
    )
  }
})
