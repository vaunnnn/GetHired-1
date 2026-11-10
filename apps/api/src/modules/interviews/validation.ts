import { DEFAULT_PHASES, QUESTION_TYPES, MCQ_QUESTION_TYPES, type PhaseConfig, type QuestionInput } from "@gethired/contracts"
import { responseDefinition } from "./response-definition.js"
import { ApiError } from "../../api/errors.js"
import { strictObject, text, oneOf, optional, pagination, type Parser } from "../../api/validation.js"
const color: Parser<string> = value => { if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) throw new ApiError("VALIDATION_ERROR"); return value }
export const phaseInput: Parser<PhaseConfig[]> = value => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) throw new ApiError("VALIDATION_ERROR")
  const ids = new Set<string>(), types = new Set<string>()
  return value.map(item => {
    const phase = strictObject(item, {
      id: (v: unknown) => { const id = text(1, 40)(v); if (!/^[a-z][a-z-]*$/.test(id) || ids.has(id)) throw new Error(); ids.add(id); return id },
      label: text(1, 80), shortLabel: text(1, 80),
      count: (v: unknown) => { if (!Number.isInteger(v) || Number(v) < 1 || Number(v) > 5) throw new Error(); return Number(v) },
      types: (v: unknown) => { if (!Array.isArray(v) || !v.length) throw new Error(); return v.map(t => { const type = oneOf(QUESTION_TYPES)(t); if (types.has(type)) throw new Error(); types.add(type); return type }) },
    })
    return phase
  })
}
function input(value: unknown, shape: Record<string, Parser<unknown>>, patch: boolean) {
  const parsed = strictObject(value, patch ? Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, optional(v)])) : shape, patch)
  return Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== undefined))
}
export function categoryInput(value: unknown, patch = false) {
  return input(value, { name: text(1, 120), description: text(0, 2000), color, bg: color,
    status: optional(oneOf(["active", "inactive"])), phases: optional(phaseInput) }, patch)
}
export function questionInput(value: unknown, patch = false) {
  const parsed = input(value, { question: text(1, 12000), type: oneOf(QUESTION_TYPES), hint: text(0, 4000), feedback: text(0, 12000),
    responseDefinition: optional(responseDefinition), status: optional(oneOf(["active", "inactive"])) }, patch)
  if (!patch) {
    parsed.responseDefinition ??= { format: "written" }
    parsed.status ??= "active"
    const question = parsed as unknown as QuestionInput
    if (question.responseDefinition?.format === "multiple_choice") {
      if (!(MCQ_QUESTION_TYPES as readonly string[]).includes(question.type))
        throw new ApiError("VALIDATION_ERROR", { fieldErrors: { type: ["Multiple choice is available for Technical, Situational, and Coding questions."] } })
      if (question.feedback !== "")
        throw new ApiError("VALIDATION_ERROR", { fieldErrors: { feedback: ["Multiple-choice questions cannot include explanations."] } })
    } else if (question.status === "active" && !question.feedback.trim()) {
      throw new ApiError("VALIDATION_ERROR", { fieldErrors: { feedback: ["Add evaluation criteria before activating a written question."] } })
    }
  }
  return parsed
}
export function bankQuery(params: URLSearchParams, admin: boolean) {
  for (const key of params.keys()) if (!["page", "pageSize", ...(admin ? ["status"] : [])].includes(key) || params.getAll(key).length !== 1) throw new ApiError("VALIDATION_ERROR")
  return { ...pagination(params), status: params.has("status") ? oneOf(["active", "inactive"])(params.get("status")) : undefined }
}
export { DEFAULT_PHASES }
