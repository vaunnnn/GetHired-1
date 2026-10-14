import { getOnboardingService } from "../modules/onboarding/routes.js"
import { closeAuthService, getDatabasePool } from "../auth/runtime.js"

// Uses the API credential/config in a separate scheduled process, once per minute.
// Durable leases prevent two workers/API requests from sending for the same operation.
try {
  const pool = getDatabasePool(), service = getOnboardingService()
  const pending = await pool.query(`select id from gethired_private.onboarding_operations where state = 'queued'
    and available_at <= clock_timestamp() and expires_at > clock_timestamp() and send_attempts < 5
    and (leased_until is null or leased_until <= clock_timestamp()) order by available_at limit 20`)
  for (const row of pending.rows) await service.deliver(row.id)
  console.log(JSON.stringify({ event: "onboarding_retry_completed", processed: pending.rows.length }))
} catch {
  console.error("Onboarding retry failed; retry on the next scheduled run.")
  process.exitCode = 1
} finally { await closeAuthService() }
