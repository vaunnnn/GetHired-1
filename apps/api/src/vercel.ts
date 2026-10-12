import express from "express"
import createApp from "./app.js"
import { getServerConfig } from "./config.js"
import { getAuthConfig } from "./auth/config.js"
import { readTransportConfig } from "./http/config.js"

// Export an Express instance for Vercel; initialize configuration only on requests.
const app = express()
app.disable("x-powered-by")
let handler: ReturnType<typeof createApp> | undefined
app.use((request, response, next) => {
  if (!handler) {
    getServerConfig()
    getAuthConfig()
    handler = createApp(readTransportConfig(process.env))
  }
  handler(request, response, next)
})

export default app
