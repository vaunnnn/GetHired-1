import { COMPANY_NICHES, COMPANY_SPECIALIZATIONS, type CompanyInput } from "@gethired/contracts"
import { ApiError } from "../../api/errors.js"
import { strictObject, text, optional, oneOf, uuid, pagination, type Parser } from "../../api/validation.js"

const website: Parser<string> = value => {
  const result = text(0, 500)(value)
  if (!result) return ""
  let url: URL
  try { url = new URL(result.includes("://") ? result : `https://${result}`) } catch { throw new ApiError("VALIDATION_ERROR") }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || !url.hostname.includes(".")) throw new ApiError("VALIDATION_ERROR")
  return url.href
}
const shape = {
  name: text(1, 160), industry: text(1, 120), type: text(1, 120), location: text(1, 250), description: text(0, 5000),
  website, email: (v: unknown) => { const s = text(0, 254)(v); if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new ApiError("VALIDATION_ERROR"); return s },
  phone: text(0, 80), hours: text(0, 250),
  slots: (v: unknown) => { if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 100000) throw new ApiError("VALIDATION_ERROR"); return v },
  specializations: (v: unknown) => {
    if (!Array.isArray(v) || !v.length || v.length > 30) throw new ApiError("VALIDATION_ERROR")
    return [...new Set(v.map(oneOf(COMPANY_SPECIALIZATIONS)))]
  },
  imageId: optional((v: unknown) => v === null ? null : uuid(v)), status: optional(oneOf(["active", "inactive"] as const)),
}
export function companyInput(value: unknown, patch = false): Partial<CompanyInput> {
  const parsers = patch ? Object.fromEntries(Object.entries(shape).map(([key, parser]) => [key, optional(parser as Parser<unknown>)])) : shape
  return Object.fromEntries(Object.entries(strictObject(value, parsers, patch)).filter(([, v]) => v !== undefined))
}
export function companyQuery(params: URLSearchParams, admin = false, bookmarks = false) {
  const allowed = bookmarks ? ["page", "pageSize"] : ["page", "pageSize", "q", "niche", "specialization", ...(admin ? ["status"] : [])]
  for (const key of params.keys()) if (!allowed.includes(key) || key !== "specialization" && params.getAll(key).length !== 1) throw new ApiError("VALIDATION_ERROR")
  const niche = params.get("niche") ?? "All"
  if (!Object.hasOwn(COMPANY_NICHES, niche)) throw new ApiError("VALIDATION_ERROR")
  const specs = params.getAll("specialization")
  if (specs.length > 30) throw new ApiError("VALIDATION_ERROR")
  return { ...pagination(params), q: text(0, 200)(params.get("q") ?? ""), niche,
    specializations: specs.map(oneOf(COMPANY_SPECIALIZATIONS)), status: params.has("status") ? oneOf(["active", "inactive"] as const)(params.get("status")) : undefined }
}
