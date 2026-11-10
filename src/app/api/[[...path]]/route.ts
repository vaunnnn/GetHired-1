import "server-only"
import { createApiProxy } from "@/server/proxy/handler"
import { getProxyConfig } from "@/server/proxy/config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// The separate Node API is the only owner of authentication and business routes.
const proxy = createApiProxy(getProxyConfig)
export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
  proxy as HEAD,
  proxy as OPTIONS,
}
