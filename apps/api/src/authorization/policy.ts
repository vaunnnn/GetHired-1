import { ApiError } from "../api/errors.js"
import type { Principal, User } from "../auth/types.js"

const permissions = {
  "session:read": ["student", "admin"],
  "companies:read": ["student", "admin"],
  "companies:write": ["admin"],
  "students:manage": ["admin"],
  "categories:read": ["student", "admin"],
  "questions:write": ["admin"],
  "bookmarks:own": ["student"],
  "interviews:own": ["student"],
} as const satisfies Record<string, readonly User["role"][]>

export type Permission = keyof typeof permissions
export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && Object.hasOwn(permissions, value)
}
export function assertPermission(principal: Principal, permission: Permission) {
  const roles: readonly string[] = permissions[permission] ?? []
  if (!roles.includes(principal.user.role)) throw new ApiError("FORBIDDEN")
}

// Apply ownership in SQL too (WHERE account_id = actor.id). Never allow an admin
// override for private student resources, including interview answers/feedback.
export function assertOwnedResource(principal: Principal, ownerId: string | undefined) {
  if (principal.user.role !== "student") throw new ApiError("FORBIDDEN")
  if (ownerId !== principal.id) throw new ApiError("NOT_FOUND")
}
