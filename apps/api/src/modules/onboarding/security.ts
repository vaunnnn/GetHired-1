import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { ApiError } from "../../api/errors.js"
import type { AuthConfig } from "../../auth/config.js"

export interface SetupConfig { key: string; adminKey: string; ttl: number }
export function setupConfig(auth: AuthConfig, env = process.env): SetupConfig {
  const key = env.AUTH_SETUP_ENCRYPTION_KEY ?? "", adminKey = env.SUPABASE_AUTH_SECRET_KEY ?? ""
  const ttl = Number(env.AUTH_SETUP_TTL_SECONDS ?? "600")
  if (!/^[a-f0-9]{64}$/i.test(key) || key.toLowerCase() === auth.cookieSecret.toLowerCase() || !adminKey || /\s/.test(adminKey) || !Number.isInteger(ttl) || ttl < 300 || ttl > 900)
    throw new ApiError("SERVICE_UNAVAILABLE")
  return { key, adminKey, ttl }
}
export function setupCrypto(key: string) {
  const bytes = Buffer.from(key, "hex")
  return {
    hash: (purpose: string, value: string) => createHmac("sha256", bytes).update(`${purpose}:${value}`).digest("hex"),
    seal(value: string, context: string) {
      const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", bytes, iv)
      cipher.setAAD(Buffer.from(context))
      const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
      return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url")
    },
    open(value: string, context: string) {
      try {
        const raw = Buffer.from(value, "base64url"), cipher = createDecipheriv("aes-256-gcm", bytes, raw.subarray(0, 12))
        cipher.setAAD(Buffer.from(context)); cipher.setAuthTag(raw.subarray(12, 28))
        return Buffer.concat([cipher.update(raw.subarray(28)), cipher.final()]).toString("utf8")
      } catch { throw new ApiError("SERVICE_UNAVAILABLE") }
    },
  }
}
// Supabase Auth's email OTP digest. Covered by the hosted compatibility checklist.
export const otpDigest = (email: string, code: string) => createHash("sha224").update(email + code).digest("hex")
export const equalProof = (left: string, right: string) => left.length === right.length && timingSafeEqual(Buffer.from(left), Buffer.from(right))
