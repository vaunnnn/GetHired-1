import { createApiRoute, type ApiContext } from "../../api/route.js"
import { ApiError } from "../../api/errors.js"
import { uuid } from "../../api/validation.js"
import { getDatabasePool } from "../../auth/runtime.js"
import { createBankRepository } from "./repository.js"
import { categoryInput, questionInput, bankQuery } from "./validation.js"
const actor = (c: ApiContext) => { if (!c.actor?.auth) throw new ApiError("UNAUTHENTICATED"); return c.actor.auth }
const repository = () => createBankRepository(getDatabasePool())
export function bankRoutes() {
  const routes = new Map<string, ReturnType<typeof createApiRoute>>()
  for (const admin of [false, true]) {
    const route = admin ? "/api/admin/categories" : "/api/categories"
    routes.set(route, createApiRoute({ route, access: { kind: "protected", permission: admin ? "questions:write" : "categories:read", transaction: "business" }, methods: {
      GET: { body: "none", handle: c => repository().list(actor(c), bankQuery(new URL(c.request.url).searchParams, admin), admin, undefined, c.authorization) },
      ...(admin ? { POST: { body: "json" as const, handle: async (c: ApiContext) => ({ status: 201, data: await repository().save(actor(c), c.requestId, categoryInput(c.body), "category", undefined, undefined, c.authorization) }) } } : {}),
    } }))
  }
  for (const kind of ["category", "question"] as const) {
    const route = `/api/admin/${kind === "category" ? "categories" : "questions"}/[id]`
    routes.set(route, createApiRoute({ route, access: { kind: "protected", permission: "questions:write", transaction: "business" }, methods: {
      PATCH: { body: "json", handle: async c => ({ data: await repository().save(actor(c), c.requestId, (kind === "category" ? categoryInput : questionInput)(c.body, true), kind, uuid(c.params.id), undefined, c.authorization) }) },
    } }))
  }
  const questions = "/api/admin/categories/[id]/questions"
  routes.set(questions, createApiRoute({ route: questions, access: { kind: "protected", permission: "questions:write", transaction: "business" }, methods: {
    GET: { body: "none", handle: c => repository().list(actor(c), bankQuery(new URL(c.request.url).searchParams, true), true, uuid(c.params.id), c.authorization) },
    POST: { body: "json", handle: async c => ({ status: 201, data: await repository().save(actor(c), c.requestId, questionInput(c.body), "question", undefined, uuid(c.params.id), c.authorization) }) },
  } }))
  const pipeline = "/api/categories/[id]/pipeline"
  routes.set(pipeline, createApiRoute({ route: pipeline, access: { kind: "protected", permission: "categories:read", transaction: "business" }, methods: {
    GET: { body: "none", handle: async c => { if (new URL(c.request.url).search) throw new ApiError("VALIDATION_ERROR"); return { data: await repository().pipeline(actor(c), uuid(c.params.id), c.authorization) } } },
  } }))
  return routes
}
