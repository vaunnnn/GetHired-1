import { createApiRoute } from "./api/route.js"
import { ApiError } from "./api/errors.js"
import { companyRoutes } from "./modules/companies/routes.js"
import { onboardingRoutes } from "./modules/onboarding/routes.js"
import { bankRoutes } from "./modules/interviews/routes.js"
import { attemptRoutes } from "./modules/interviews/attempt-routes.js"
import { getAuthService, checkReadiness } from "./auth/runtime.js"

export function createRoutes() {
  const routes = companyRoutes()
  for (const [path, handler] of attemptRoutes()) routes.set(path, handler)
  for (const [path, handler] of bankRoutes()) routes.set(path, handler)
  for (const [path, handler] of onboardingRoutes()) routes.set(path, handler)
  routes.set("/api/health/ready", createApiRoute({
    route: "/api/health/ready",
    access: { kind: "public" },
    methods: { GET: { body: "none", handle: async () => {
      await checkReadiness()
      return { data: { status: "ok" } }
    } } },
  }))
  routes.set("/api/health/live", createApiRoute({
    route: "/api/health/live",
    access: { kind: "public" },
    methods: { GET: { body: "none", handle: () => ({ data: { status: "ok" } }) } },
  }))
  routes.set("/api/auth/csrf", createApiRoute({
    route: "/api/auth/csrf",
    access: { kind: "public" },
    methods: { GET: { body: "none", handle: ({ request }) => getAuthService().csrf(request) } },
  }))
  routes.set("/api/auth/me", createApiRoute({
    route: "/api/auth/me",
    access: { kind: "protected", permission: "session:read" },
    methods: { GET: { body: "none", handle: ({ actor }) => {
      if (!actor?.auth) throw new ApiError("UNAUTHENTICATED")
      return getAuthService().me(actor.auth)
    } } },
  }))
  for (const operation of ["login", "refresh", "logout"] as const) {
    const route = `/api/auth/${operation}`
    routes.set(route, createApiRoute({
      route,
      access: { kind: "public" },
      methods: { POST: { body: "json", handle: ({ request, body }) => getAuthService()[operation](request, body) } },
    }))
  }
  return routes
}
