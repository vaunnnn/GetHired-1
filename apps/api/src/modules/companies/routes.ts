import { createApiRoute, type ApiContext } from "../../api/route.js"
import { ApiError } from "../../api/errors.js"
import { strictObject, uuid } from "../../api/validation.js"
import { getDatabasePool } from "../../auth/runtime.js"
import { createCompanyRepository } from "./repository.js"
import { companyInput, companyQuery } from "./validation.js"
import { uploadImage } from "./images.js"

const actor = (c: ApiContext) => { if (!c.actor?.auth) throw new ApiError("UNAUTHENTICATED"); return c.actor.auth }
const repository = () => createCompanyRepository(getDatabasePool())
export function companyRoutes() {
  const routes = new Map<string, ReturnType<typeof createApiRoute>>()
  for (const admin of [false, true]) {
    const route = admin ? "/api/admin/companies" : "/api/companies"
    routes.set(route, createApiRoute({ route, access: { kind: "protected", permission: admin ? "companies:write" : "companies:read" }, methods: {
      GET: { body: "none", handle: c => repository().list(actor(c), companyQuery(new URL(c.request.url).searchParams, admin), admin) },
      ...(admin ? { POST: { body: "json" as const, handle: async (c: ApiContext) => ({ status: 201, data: await repository().save(actor(c), c.requestId, companyInput(c.body)) }) } } : {}),
    } }))
    const detail = `${route}/[companyId]`
    routes.set(detail, createApiRoute({ route: detail, access: { kind: "protected", permission: admin ? "companies:write" : "companies:read" }, methods: admin ? {
      PATCH: { body: "json", handle: async c => ({ data: await repository().save(actor(c), c.requestId, companyInput(c.body, true), uuid(c.params.companyId)) }) },
    } : { GET: { body: "none", handle: async c => ({ data: await repository().get(actor(c), uuid(c.params.companyId)) }) } } }))
  }
  const bookmarks = "/api/me/bookmarks"
  routes.set(bookmarks, createApiRoute({ route: bookmarks, access: { kind: "protected", permission: "bookmarks:own" }, methods: {
    GET: { body: "none", handle: c => repository().list(actor(c), companyQuery(new URL(c.request.url).searchParams, false, true), false, true) },
  } }))
  routes.set(`${bookmarks}/[companyId]`, createApiRoute({ route: `${bookmarks}/[companyId]`, access: { kind: "protected", permission: "bookmarks:own" }, methods: {
    PUT: { body: "json", handle: async c => { strictObject(c.body, {}); return { data: await repository().bookmark(actor(c), uuid(c.params.companyId)) } } },
    DELETE: { body: "none", handle: async c => ({ data: await repository().bookmark(actor(c), uuid(c.params.companyId), true) }) },
  } }))
  const images = "/api/admin/company-images"
  routes.set(images, createApiRoute({ route: images, access: { kind: "protected", permission: "companies:write" }, methods: {
    POST: { body: "image", handle: async c => ({ status: 201, data: await uploadImage(getDatabasePool(), actor(c), c.requestId, c.body as Buffer) }) },
  } }))
  return routes
}
