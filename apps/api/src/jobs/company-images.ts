import { Pool } from "pg"
import { cleanCompanyImages } from "../modules/companies/cleanup.js"
import { imageStorage } from "../modules/companies/images.js"

let pool: Pool | undefined
try {
  const connectionString = process.env.MAINTENANCE_DATABASE_URL
  const url = new URL(connectionString ?? "")
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.username || url.search || url.hash) throw new Error("Invalid configuration")
  const storage = imageStorage()
  pool = new Pool({ connectionString, ssl: { rejectUnauthorized: true }, max: 1, connectionTimeoutMillis: 5000, statement_timeout: 30000 })
  pool.on("error", () => {})
  const result = await cleanCompanyImages(pool, storage)
  console.log(JSON.stringify({ event: "company_images.cleanup", ...result }))
  if (result.failed) process.exitCode = 1
} catch {
  console.error("Company image cleanup failed. Check worker configuration and retry.")
  process.exitCode = 1
} finally { await pool?.end() }
