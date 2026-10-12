import { ApiError } from "../api/errors.js"
import { getServerConfig } from "../config.js"
import { getAuthConfig } from "./config.js"
import { createJwtVerifier } from "./jwt.js"
import { createProvider } from "./provider.js"
import { createAuthService } from "./service.js"
import { createAuthStore, createDatabasePool } from "./store.js"
import { createReadinessProbe } from "../health.js"

let service: ReturnType<typeof createAuthService> | undefined
let pool: ReturnType<typeof createDatabasePool> | undefined
let probe: ReturnType<typeof createReadinessProbe> | undefined
export function getDatabasePool() {
  const config = getAuthConfig()
  if (!config.enabled) throw new ApiError("SERVICE_UNAVAILABLE")
  return pool ??= createDatabasePool(config)
}
export async function checkReadiness() {
  const config = getAuthConfig()
  if (!config.enabled) throw new ApiError("SERVICE_UNAVAILABLE")
  probe ??= createReadinessProbe(pool ??= createDatabasePool(config))
  await probe()
}
export function getAuthService() {
  const config = getAuthConfig()
  if (!config.enabled) throw new ApiError("SERVICE_UNAVAILABLE")
  return (service ??= createAuthService({
    config,
    appOrigin: getServerConfig().appOrigin,
    provider: createProvider(config),
    verify: createJwtVerifier(config),
    store: createAuthStore(pool ??= createDatabasePool(config)),
  }))
}

export async function closeAuthService() {
  await pool?.end()
  pool = undefined
  service = undefined
  probe = undefined
}
