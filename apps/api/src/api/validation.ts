import { ApiError } from "./errors.js"
import { UUID } from "../auth/types.js"

export type Parser<T> = (value: unknown) => T
export function strictObject<S extends Record<string, Parser<unknown>>>(value: unknown, shape: S, patch = false): { [K in keyof S]: ReturnType<S[K]> } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError("VALIDATION_ERROR")
  const data = value as Record<string, unknown>
  if (Object.keys(data).some(key => !Object.hasOwn(shape, key)) || patch && !Object.keys(data).length)
    throw new ApiError("VALIDATION_ERROR")
  const result: Record<string, unknown> = Object.create(null)
  const fieldErrors: Record<string, string[]> = Object.create(null)
  for (const [key, parse] of Object.entries(shape)) {
    try { result[key] = parse(data[key]) }
    catch { fieldErrors[key] = ["Enter a valid value."] }
  }
  if (Object.keys(fieldErrors).length) throw new ApiError("VALIDATION_ERROR", { fieldErrors })
  return result as { [K in keyof S]: ReturnType<S[K]> }
}
export function text(min: number, max: number): Parser<string> {
  return value => {
    if (typeof value !== "string" || value.trim().length < min || value.trim().length > max)
      throw new ApiError("VALIDATION_ERROR")
    return value.trim()
  }
}
export const uuid: Parser<string> = value => {
  if (typeof value !== "string" || !UUID.test(value)) throw new ApiError("VALIDATION_ERROR")
  return value.toLowerCase()
}
export function optional<T>(parser: Parser<T>): Parser<T | undefined> {
  return value => value === undefined ? undefined : parser(value)
}
export function oneOf<const T extends string>(values: readonly T[]): Parser<T> {
  return value => {
    if (typeof value !== "string" || !values.includes(value as T)) throw new ApiError("VALIDATION_ERROR")
    return value as T
  }
}
export function pagination(params: URLSearchParams) {
  const parse = (key: string, fallback: number, max: number) => {
    const values = params.getAll(key)
    if (!values.length) return fallback
    if (values.length !== 1 || !/^[1-9][0-9]*$/.test(values[0])) throw new ApiError("VALIDATION_ERROR")
    const value = Number(values[0])
    if (!Number.isSafeInteger(value) || value > max) throw new ApiError("VALIDATION_ERROR")
    return value
  }
  return { page: parse("page", 1, 1_000_000), pageSize: parse("pageSize", 20, 100) }
}
