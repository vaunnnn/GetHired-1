import { createApiRoute, type ApiContext } from "../../api/route.js"
import { ApiError } from "../../api/errors.js"
import { strictObject, uuid } from "../../api/validation.js"
import { getAuthConfig } from "../../auth/config.js"
import { getDatabasePool } from "../../auth/runtime.js"
import { createAuthStore } from "../../auth/store.js"
import { getServerConfig } from "../../config.js"
import { createSetupProvider } from "./provider.js"
import { createOnboardingService } from "./service.js"
import { setupConfig } from "./security.js"
import { codeInput, emailInput, passwordInput, signupInput, studentInput, studentPatch, studentQuery } from "./input.js"
import { createStudentRepository } from "./students.js"

export function getOnboardingService() {
  const auth = getAuthConfig(), setup = setupConfig(auth), pool = getDatabasePool(), appOrigin = getServerConfig().appOrigin
  return createOnboardingService({ pool, auth, setup, appOrigin, limits: createAuthStore(pool), provider: createSetupProvider(auth, setup, appOrigin) })
}
const actor = (c: ApiContext) => { if (!c.actor?.auth) throw new ApiError("UNAUTHENTICATED"); return c.actor.auth }
export function onboardingRoutes() {
  const routes = new Map<string, ReturnType<typeof createApiRoute>>()
  const post = (suffix: string, handle: (c: ApiContext) => ReturnType<ReturnType<typeof createOnboardingService>["signup"]>) => {
    const route = `/api/auth/${suffix}`
    routes.set(route, createApiRoute({ route, access: { kind: "public" }, methods: { POST: { body: "json", handle } } }))
  }
  post("signup", c => getOnboardingService().signup(c.request, signupInput(c.body)))
  post("signup/resend", c => { const input = strictObject(c.body, { challengeId: uuid }); return getOnboardingService().resend(c.request, input.challengeId) })
  post("signup/verify", c => { const input = strictObject(c.body, { challengeId: uuid, code: codeInput, newPassword: passwordInput }); return getOnboardingService().verifySignup(c.request, input.challengeId, input.code, input.newPassword) })
  post("password-reset/request", c => { const input = strictObject(c.body, { email: emailInput }); return getOnboardingService().requestRecovery(c.request, input.email) })
  post("password-reset/verify", c => { const input = strictObject(c.body, { challengeId: uuid, code: codeInput }); return getOnboardingService().verifyRecovery(c.request, input.challengeId, input.code) })
  post("password-reset/complete", c => { const input = strictObject(c.body, { newPassword: passwordInput }); return getOnboardingService().completeRecovery(c.request, input.newPassword) })
  post("invitations/accept", c => {
    const input = strictObject(c.body, { tokenHash: value => { if (typeof value !== "string" || !/^[a-f0-9]{56}$/.test(value)) throw new ApiError("VALIDATION_ERROR"); return value }, newPassword: passwordInput })
    return getOnboardingService().acceptInvitation(c.request, input.tokenHash, input.newPassword)
  })
  const repository = () => createStudentRepository(getDatabasePool()), route = "/api/admin/students"
  routes.set(route, createApiRoute({ route, access: { kind: "protected", permission: "students:manage" }, methods: {
    GET: { body: "none", handle: c => repository().list(actor(c), studentQuery(new URL(c.request.url).searchParams)) },
    POST: { body: "json", handle: async c => ({ status: 201, data: await repository().create(actor(c), c.requestId, studentInput(c.body)) }) },
  } }))
  routes.set(`${route}/[studentId]`, createApiRoute({ route: `${route}/[studentId]`, access: { kind: "protected", permission: "students:manage" }, methods: {
    PATCH: { body: "json", handle: async c => ({ data: await repository().patch(actor(c), c.requestId, uuid(c.params.studentId), studentPatch(c.body)) }) },
  } }))
  routes.set(`${route}/[studentId]/invitations`, createApiRoute({ route: `${route}/[studentId]/invitations`, access: { kind: "protected", permission: "students:manage" }, methods: {
    POST: { body: "json", handle: c => { strictObject(c.body, {}); return getOnboardingService().invite(actor(c), c.requestId, uuid(c.params.studentId)) } },
  } }))
  return routes
}
