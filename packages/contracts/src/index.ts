export * from "./companies.js"
export * from "./students.js"
export * from "./interviews.js"
/** Public wire types only. Never add provider tokens or private account/session rows. */
export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
}

export interface ApiSuccess<T> {
  data: T
  requestId: string
  meta?: PaginationMeta
}

export interface ApiFailure {
  error: { code: string; message: string; fieldErrors?: Record<string, string[]> }
  requestId: string
}

export interface User {
  id: string
  role: "student" | "admin"
  displayName: string
  email: string
  student: null | {
    studentNumber: string
    firstName: string
    lastName: string
    course: string
    yearLevel: string
  }
}

export interface SessionSummary {
  expiresAt: string
  rememberMe: boolean
}

export interface LoginInput {
  identifier: string
  password: string
  rememberMe?: boolean
}

export interface CurrentUser {
  user: User
  session: SessionSummary
}

/** Refresh preserves session fields and includes the verified current user. */
export type RefreshResult = CurrentUser
