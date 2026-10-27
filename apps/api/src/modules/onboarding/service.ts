import { randomUUID } from "node:crypto"
import { isIP } from "node:net"
import type { SignupInput, StudentInput } from "@gethired/contracts"
import type { QueryResultRow } from "pg"
import { ApiError } from "../../api/errors.js"
import type { ApiResult } from "../../api/responses.js"
import type { AuthConfig } from "../../auth/config.js"
import { createBrowserSecurity } from "../../auth/cookies.js"
import type { AuthStore, SqlClient, SqlPool } from "../../auth/store.js"
import type { Principal } from "../../auth/types.js"
import { authorizedTransaction, transaction } from "../../db/transaction.js"
import { appendAudit } from "../../db/events.js"
import type { createSetupProvider, ProofType } from "./provider.js"
import { equalProof, otpDigest, setupCrypto, type SetupConfig } from "./security.js"

const message = "If this request is eligible, an email will arrive shortly. Use the newest email and this browser to continue."
interface Operation extends QueryResultRow {
  id: string; email: string; purpose: "signup" | "invite" | "recovery"; browser_hash: string | null;
  profile: StudentInput | null; account_id: string | null; auth_user_id: string | null;
  proof_hash: string | null; provider_type: ProofType; state: string; attempts: number;
  expires_at: Date; lease_token: string | null; leased_until: Date | null; send_attempts: number;
}
export interface OnboardingDependencies {
  pool: SqlPool; auth: AuthConfig; setup: SetupConfig; appOrigin: string; limits: Pick<AuthStore, "consumeLimit">;
  provider: ReturnType<typeof createSetupProvider>;
}
export function createOnboardingService({ pool, auth, setup, appOrigin, limits, provider }: OnboardingDependencies) {
  const crypto = setupCrypto(setup.key), browser = createBrowserSecurity(auth, appOrigin)
  const recoveryCookie = `${auth.production ? "__Host-gethired-" : "gethired-dev-"}recovery`
  const invalid = (purpose: string) => new ApiError(purpose === "recovery" ? "INVALID_RECOVERY_CODE" : "INVALID_VERIFICATION_CODE")
  const bound = (request: Request) => crypto.hash("browser", browser.assertMutation(request).nonce)
  const lockEmail = (c: SqlClient, email: string) => c.query("select pg_advisory_xact_lock(hashtextextended($1, 5))", [email])
  const snapshot = async (c: SqlClient, id: string) => (await c.query("select * from gethired_private.setup_provider_snapshot($1)", [id])).rows[0]
  async function assertLease(c: SqlClient, op: Operation) {
    const row = await c.query(`select id from gethired_private.onboarding_operations where id = $1 and lease_token = $2
      and leased_until > clock_timestamp() and expires_at > clock_timestamp() and state not in ('completed','superseded','failed') for update`, [op.id, op.lease_token])
    if (!row.rows.length) throw invalid(op.purpose)
  }
  async function rate(request: Request, target: string) {
    const ip = auth.trustedIpHeader ? request.headers.get(auth.trustedIpHeader) : "development"
    if (!ip || auth.trustedIpHeader && !isIP(ip)) throw new ApiError("SERVICE_UNAVAILABLE")
    await limits.consumeLimit(`setup:ip:${crypto.hash("ip", ip)}`, 30, 900)
    await limits.consumeLimit(`setup:target:${crypto.hash("target", target)}`, 5, 900)
  }
  async function insert(c: SqlClient, purpose: Operation["purpose"], email: string, binding: string | null, profile: StudentInput | null, accountId: string | null) {
    await lockEmail(c, email)
    // A provider request owns a short lease. New public requests must not supersede
    // an in-flight verification or cause concurrent email sends for this identity.
    const busy = await c.query(`select id from gethired_private.onboarding_operations where email = $1
      and leased_until > clock_timestamp() and state not in ('completed','superseded','failed')`, [email])
    if (busy.rows.length) return null
    await c.query(`update gethired_private.onboarding_operations set state = 'superseded', profile = null, provider_credential = null
      where email = $1 and state not in ('completed','superseded')`, [email])
    const id = randomUUID()
    await c.query(`insert into gethired_private.onboarding_operations(id,purpose,email,browser_hash,profile,account_id,provider_type,expires_at)
      values ($1,$2,$3,$4,$5,$6,$7,clock_timestamp() + $8 * interval '1 second')`,
    [id, purpose, email, binding, profile, accountId, purpose === "signup" ? "signup" : purpose === "invite" ? "invite" : "recovery", setup.ttl])
    return id
  }
  async function release(id: string, lease: string) {
    await transaction(pool, c => c.query(`update gethired_private.onboarding_operations set lease_token = null, leased_until = null
      where id = $1 and lease_token = $2`, [id, lease]))
  }
  async function claim(id: string) {
    return transaction(pool, async c => {
      const initial = (await c.query<Operation>("select * from gethired_private.onboarding_operations where id = $1", [id])).rows[0]
      if (!initial) return null
      await lockEmail(c, initial.email)
      const result = await c.query<Operation>(`update gethired_private.onboarding_operations set lease_token = $2,
        leased_until = clock_timestamp() + interval '60 seconds' where id = $1 and expires_at > clock_timestamp()
        and (leased_until is null or leased_until <= clock_timestamp()) and state not in ('completed','superseded','failed') returning *`, [id, randomUUID()])
      return result.rows[0] ?? null
    })
  }
  async function eligible(c: SqlClient, op: Operation) {
    const a = (await c.query("select * from gethired_private.accounts where lower(email) = $1", [op.email])).rows[0]
    return op.purpose === "recovery" ? !!a && a.status === "active" && a.auth_user_id === op.auth_user_id
      : !a ? op.purpose === "signup" : a.role === "student" && a.status === "pending" && (!a.auth_user_id || !op.auth_user_id || a.auth_user_id === op.auth_user_id)
  }
  // Also called by the scheduled email worker. Passwords are never persisted.
  async function deliver(id: string, password?: string) {
    const op = await claim(id)
    if (!op || op.state !== "queued") { if (op) await release(id, op.lease_token!); return }
    try {
      if (!await transaction(pool, c => eligible(c, op))) throw invalid(op.purpose)
      let before = await transaction(pool, c => snapshot(c, id))
      const type: ProofType = op.purpose === "recovery" || before?.confirmed ? "recovery" : op.purpose === "invite" ? "invite" : "signup"
      await transaction(pool, c => c.query("update gethired_private.onboarding_operations set provider_type = $2, send_attempts = send_attempts + 1 where id = $1", [id, type]))
      if (op.purpose === "signup" && !before) {
        if (!password) throw invalid(op.purpose) // Explicit signup retry supplies it again.
        await provider.signup(op.email, password)
      } else await provider.send(op.email, type, op.purpose === "invite")
      await transaction(pool, async c => {
        await assertLease(c, op)
        const proof = await snapshot(c, id)
        if (!proof || !/^[a-f0-9]{56}$/.test(proof.token_hash ?? "") || !proof.sent_at || new Date(proof.sent_at).getTime() < Date.now() - setup.ttl * 1000)
          throw new ApiError("SERVICE_UNAVAILABLE")
        await c.query(`update gethired_private.onboarding_operations set state = 'sent', auth_user_id = $2, proof_hash = $3
          where id = $1 and lease_token = $4`, [id, proof.user_id, crypto.hash("proof", proof.token_hash), op.lease_token])
      })
    } catch (error) {
      await transaction(pool, c => c.query(`update gethired_private.onboarding_operations set state = case when send_attempts >= 5 or $2 then 'failed' else 'queued' end,
        available_at = clock_timestamp() + interval '1 minute' * greatest(send_attempts,1) where id = $1 and lease_token = $3
        and state not in ('completed','superseded','failed')`,
      [id, error instanceof ApiError && ["INVALID_VERIFICATION_CODE", "INVALID_RECOVERY_CODE"].includes(error.code), op.lease_token]))
      // Provider diagnostics, addresses and credentials never enter logs. State/attempts
      // remain observable in the operator view; all public starts have one response.
    } finally { await release(id, op.lease_token!) }
  }
  async function start(request: Request, purpose: "signup" | "recovery", email: string, profile: StudentInput | null, password?: string): Promise<ApiResult> {
    const binding = bound(request)
    await rate(request, email)
    const id = await transaction(pool, async c => {
      await lockEmail(c, email)
      const a = (await c.query("select * from gethired_private.accounts where lower(email) = $1", [email])).rows[0]
      if (purpose === "recovery" ? !a || a.status !== "active" || !a.auth_user_id : a && (a.role !== "student" || a.status !== "pending")) return null
      const id = await insert(c, purpose, email, binding, profile, a?.id ?? null)
      if (id && a?.auth_user_id) await c.query("update gethired_private.onboarding_operations set auth_user_id = $2 where id = $1", [id, a.auth_user_id])
      return id
    })
    if (id) await deliver(id, password)
    return { status: 202, data: { message, challengeId: id ?? randomUUID() } }
  }
  // Local comparison uses the provider's issued proof snapshot, preventing a code
  // from a superseded request being applied to different browser/profile data.
  async function verify(request: Request, purpose: Operation["purpose"], id: string, proof: string, newPassword?: string): Promise<ApiResult> {
    const binding = bound(request)
    await rate(request, `verify:${id}`)
    const op = await claim(id)
    if (!op) throw invalid(purpose)
    try {
      const digest = purpose === "invite" ? proof : otpDigest(op.email, proof)
      if (op.purpose !== purpose || (purpose !== "invite" && op.browser_hash !== binding) || !op.proof_hash ||
        !["sent", "verifying", "verified"].includes(op.state) || op.attempts >= 5) throw invalid(purpose)
      await transaction(pool, c => c.query("update gethired_private.onboarding_operations set attempts = attempts + 1 where id = $1", [id]))
      if (!equalProof(crypto.hash("proof", digest), op.proof_hash)) throw invalid(purpose)
      if (!await transaction(pool, c => eligible(c, op))) throw invalid(purpose)
      if (purpose === "invite" && op.browser_hash && op.browser_hash !== binding) throw invalid(purpose)
      if (op.state !== "verified") {
        await transaction(pool, async c => { await assertLease(c, op); await c.query("update gethired_private.onboarding_operations set state = 'verifying', browser_hash = $2 where id = $1", [id, binding]) })
        let credential: string | null = null
        try {
          const session = await provider.verify(digest, op.provider_type)
          if (session.userId !== op.auth_user_id || session.email !== op.email) throw invalid(purpose)
          credential = crypto.seal(JSON.stringify(session), id)
          await transaction(pool, async c => {
            await assertLease(c, op)
            await c.query("insert into gethired_private.provider_cleanup(session_id,auth_user_id) values ($1,$2) on conflict do nothing", [session.sessionId, session.userId])
          })
          try { await provider.end(session.accessToken) } catch { /* Durable cleanup retries this session. */ }
        } catch (error) {
          // A locally matched, purpose-bound proof was persisted before the call.
          // Reconcile only a consumed provider proof on an earlier in-flight attempt;
          // confirmed identity by itself can never authorize a first verification.
          const current = await transaction(pool, c => snapshot(c, id))
          if (op.state !== "verifying" || !current?.confirmed || current.token_hash || current.user_id !== op.auth_user_id) throw error
        }
        await transaction(pool, async c => { await assertLease(c, op); await c.query("update gethired_private.onboarding_operations set state = 'verified', provider_credential = $2 where id = $1", [id, credential]) })
      }
      if (purpose === "recovery") {
        const headers = new Headers()
        setRecovery(headers, `${id}.${crypto.hash("grant", `${id}:${binding}`)}`, setup.ttl)
        return { data: { verified: true }, headers }
      }
      if (!newPassword) throw new ApiError("VALIDATION_ERROR")
      await complete(op, newPassword)
      return { data: purpose === "signup" ? { accountReady: true, status: "active" } : { accountReady: true } }
    } catch (error) {
      if (error instanceof ApiError && error.code === "INVALID_VERIFICATION_CODE") throw invalid(purpose)
      throw error
    } finally { await release(id, op.lease_token!) }
  }
  function setRecovery(headers: Headers, value: string, age: number) {
    headers.append("Set-Cookie", `${recoveryCookie}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${auth.production ? "; Secure" : ""}`)
  }
  async function complete(op: Operation, password: string) {
    const lockCompletion = async (c: SqlClient) => {
      await lockEmail(c, op.email)
      const account = (await c.query("select id from gethired_private.accounts where lower(email) = $1", [op.email])).rows[0]
      if (account) await c.query("select gethired_private.lock_account($1, true)", [account.id])
      await assertLease(c, op)
    }
    await transaction(pool, async c => {
      await lockCompletion(c)
      if (!await eligible(c, op)) throw invalid(op.purpose)
      if (op.purpose !== "recovery") await c.query("select gethired_private.bind_verified_student($1)", [op.id])
      else {
        // Commit the login barrier/revocations before changing external credentials.
        // A failed/ambiguous password update stays blocked until recovery completes.
        await c.query("select gethired_private.lock_account($1, true)", [op.account_id])
        const result = await c.query("update gethired_private.accounts set credentials_blocked = true where id = $1 and status = 'active' returning id", [op.account_id])
        if (!result.rows.length) throw invalid(op.purpose)
        await c.query("update gethired_private.sessions set revoked_at = coalesce(revoked_at, clock_timestamp()) where account_id = $1", [op.account_id])
        await c.query(`insert into gethired_private.provider_cleanup(session_id,auth_user_id)
          select s.id,a.auth_user_id from gethired_private.sessions s join gethired_private.accounts a on a.id = s.account_id
          where a.id = $1 on conflict do nothing`, [op.account_id])
      }
    })
    await provider.password(op.auth_user_id!, password)
    await transaction(pool, async c => { await lockCompletion(c); await c.query("select gethired_private.finish_account_setup($1)", [op.id]) })
  }
  return {
    deliver,
    signup: (request: Request, input: SignupInput) => { const { password, ...profile } = input; return start(request, "signup", input.email, profile, password) },
    requestRecovery: (request: Request, email: string) => start(request, "recovery", email, null),
    verifySignup: (request: Request, id: string, code: string, password: string) => verify(request, "signup", id, code, password),
    verifyRecovery: (request: Request, id: string, code: string) => verify(request, "recovery", id, code),
    async resend(request: Request, id: string): Promise<ApiResult> {
      const binding = bound(request)
      const old = await transaction(pool, async c => (await c.query<Operation>(`select * from gethired_private.onboarding_operations
        where id = $1 and purpose = 'signup' and browser_hash = $2 and state in ('queued','sent','failed')
        and expires_at > clock_timestamp()`, [id, binding])).rows[0])
      if (!old?.profile) { await rate(request, id); return { status: 202, data: { message, challengeId: randomUUID() } } }
      return start(request, "signup", old.email, old.profile)
    },
    async invite(actor: Principal, requestId: string, id: string): Promise<ApiResult> {
      await limits.consumeLimit(`setup:invite:${id}`, 3, 900)
      const operationId = await authorizedTransaction(pool, actor, "students:manage", async c => {
        const a = (await c.query("select * from gethired_private.accounts where id = $1 and role = 'student'", [id])).rows[0]
        if (!a) throw new ApiError("NOT_FOUND")
        if (a.status !== "pending") throw new ApiError("CONFLICT")
        const op = await insert(c, "invite", a.email, null, null, id)
        if (!op) throw new ApiError("CONFLICT")
        if (a.auth_user_id) await c.query("update gethired_private.onboarding_operations set auth_user_id = $2 where id = $1", [op, a.auth_user_id])
        await appendAudit(c, { actorId: actor.id, requestId, action: "student.invitation_requested", resourceType: "student", resourceId: id })
        return op
      })
      await deliver(operationId)
      return { status: 202, data: { message: "Invitation queued. Delivery failures are retried automatically." } }
    },
    async acceptInvitation(request: Request, tokenHash: string, password: string) {
      bound(request)
      await rate(request, `invitation:${crypto.hash("invitation-rate", tokenHash)}`)
      const row = await transaction(pool, async c => (await c.query("select id from gethired_private.onboarding_operations where purpose = 'invite' and proof_hash = $1", [crypto.hash("proof", tokenHash)])).rows[0])
      if (!row) throw invalid("invite")
      return verify(request, "invite", row.id, tokenHash, password)
    },
    async completeRecovery(request: Request, password: string): Promise<ApiResult> {
      const binding = bound(request), cookie = browser.read(request, recoveryCookie)
      const [id, grant, extra] = (cookie ?? "").split(".")
      if (!id || !/^[a-f0-9-]{36}$/.test(id) || !grant || extra || !equalProof(grant, crypto.hash("grant", `${id}:${binding}`))) throw invalid("recovery")
      await rate(request, `complete:${id}`)
      const op = await claim(id)
      if (!op) throw invalid("recovery")
      try {
        if (op.purpose !== "recovery" || op.state !== "verified" || op.browser_hash !== binding) throw invalid("recovery")
        await complete(op, password)
        const headers = new Headers(); setRecovery(headers, "", 0); browser.clear(headers)
        return { data: { passwordUpdated: true }, headers }
      } finally { await release(id, op.lease_token!) }
    },
  }
}
