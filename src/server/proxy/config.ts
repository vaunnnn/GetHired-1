export interface ProxyConfig {
  apiOrigin: string
  gatewaySecret: string
  trustedIpHeader?: string
  production: boolean
  timeoutMs: number
}

export function readProxyConfig(env: Readonly<Record<string, string | undefined>>): ProxyConfig | undefined {
  // Unconfigured frontend builds and demo screens remain usable; /api fails closed.
  const boundUrl = env.API_SERVICE_URL
  const baseUrl = boundUrl ?? env.API_BASE_URL
  const variable = boundUrl !== undefined ? "API_SERVICE_URL" : "API_BASE_URL"
  if (baseUrl === undefined) return undefined
  let upstream: URL
  try { upstream = new URL(baseUrl) } catch { throw new Error(`${variable} must be an HTTP(S) URL.`) }
  if (!["http:", "https:"].includes(upstream.protocol) || upstream.username || upstream.password ||
    (!boundUrl && upstream.pathname !== "/") || upstream.search || upstream.hash ||
    (!boundUrl && env.NODE_ENV === "production" && upstream.protocol !== "https:" && env.API_ALLOW_PRIVATE_HTTP !== "true"))
    throw new Error(`${variable} is invalid; manually configured production HTTP requires explicit private-network configuration.`)
  if (!/^[a-f0-9]{64}$/i.test(env.API_GATEWAY_SECRET ?? ""))
    throw new Error("API_GATEWAY_SECRET must be 32 random bytes encoded as 64 hex characters.")
  const trustedIpHeader = env.API_INGRESS_IP_HEADER?.toLowerCase() || undefined
  const reserved = ["x-gethired-client-ip", "x-gethired-gateway", "cookie", "origin", "host", "authorization", "x-csrf-token"]
  if (trustedIpHeader && (!/^[a-z0-9-]+$/.test(trustedIpHeader) || reserved.includes(trustedIpHeader)))
    throw new Error("API_INGRESS_IP_HEADER must name an ingress-owned, single-IP header.")
  if (env.NODE_ENV === "production" && !trustedIpHeader)
    throw new Error("API_INGRESS_IP_HEADER requires a verified production ingress configuration.")
  return { apiOrigin: upstream.href.replace(/\/$/, ""), gatewaySecret: env.API_GATEWAY_SECRET!, trustedIpHeader,
    production: env.NODE_ENV === "production", timeoutMs: 25000 }
}

export function getProxyConfig() {
  return readProxyConfig(process.env)
}
