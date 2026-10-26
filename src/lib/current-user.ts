import type { CurrentUser } from "@gethired/contracts";

export function isCurrentUser(value: unknown): value is CurrentUser {
  if (!value || typeof value !== "object") return false;
  const { user, session } = value as CurrentUser;
  if (
    !user ||
    typeof user.id !== "string" ||
    !user.id ||
    !["student", "admin"].includes(user.role) ||
    typeof user.displayName !== "string" ||
    typeof user.email !== "string" ||
    !session ||
    typeof session.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(session.expiresAt)) ||
    typeof session.rememberMe !== "boolean"
  )
    return false;
  if (user.role === "admin") return user.student === null;
  return (
    !!user.student &&
    ["studentNumber", "firstName", "lastName", "course", "yearLevel"].every(
      (key) =>
        typeof user.student![key as keyof NonNullable<typeof user.student>] ===
        "string",
    )
  );
}
