import { STUDENT_COURSES, STUDENT_YEARS } from "@gethired/contracts"
import { ApiError } from "../../api/errors.js"
import { oneOf, optional, pagination, strictObject, text } from "../../api/validation.js"

export const studentEmail = (value: unknown) => {
  const email = text(3, 254)(value).toLowerCase()
  if (!/^\d{8}@usc\.edu\.ph$/.test(email)) throw new ApiError("VALIDATION_ERROR")
  return email
}
export const emailInput = (value: unknown) => {
  const email = text(3, 254)(value).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError("VALIDATION_ERROR")
  return email
}
export const passwordInput = (value: unknown) => {
  if (typeof value !== "string" || value.length < 12 || value.length > 128) throw new ApiError("VALIDATION_ERROR")
  return value
}
export const codeInput = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{6,10}$/.test(value)) throw new ApiError("VALIDATION_ERROR")
  return value
}
const profile = { firstName: text(1, 100), lastName: text(1, 100), course: oneOf(STUDENT_COURSES), yearLevel: oneOf(STUDENT_YEARS) }
export const studentInput = (value: unknown) => strictObject(value, { ...profile, email: studentEmail })
export const signupInput = (value: unknown) => strictObject(value, { ...profile, email: studentEmail, password: passwordInput })
export const studentPatch = (value: unknown) => strictObject(value, {
  firstName: optional(profile.firstName), lastName: optional(profile.lastName), course: optional(profile.course),
  yearLevel: optional(profile.yearLevel), status: optional(oneOf(["active", "inactive"] as const)),
}, true)
export function studentQuery(params: URLSearchParams) {
  for (const key of params.keys()) if (!["q", "course", "status", "page", "pageSize"].includes(key) || params.getAll(key).length !== 1) throw new ApiError("VALIDATION_ERROR")
  return { ...pagination(params), q: params.has("q") ? text(0, 100)(params.get("q")) : "",
    course: params.has("course") ? oneOf(STUDENT_COURSES)(params.get("course")) : undefined,
    status: params.has("status") ? oneOf(["pending", "active", "inactive"] as const)(params.get("status")) : undefined }
}
