export const API_ERRORS = {
  INVALID_JSON: [400, "Send a valid JSON object."],
  VALIDATION_ERROR: [400, "Check the highlighted fields."],
  INVALID_RECOVERY_CODE: [400, "The recovery code is invalid or has expired."],
  INVALID_VERIFICATION_CODE: [400, "The verification code is invalid or has expired."],
  UNAUTHENTICATED: [401, "Sign in to continue."],
  SESSION_EXPIRED: [401, "Your session has expired. Sign in again."],
  INVALID_CREDENTIALS: [401, "The sign-in details are invalid."],
  FORBIDDEN: [403, "You do not have permission to perform this action."],
  CSRF_FAILED: [403, "The request could not be verified."],
  NOT_FOUND: [404, "The requested resource was not found."],
  METHOD_NOT_ALLOWED: [405, "This method is not supported."],
  CONFLICT: [409, "The request conflicts with the current resource state."],
  CATEGORY_UNAVAILABLE: [409, "This category does not yet have enough active questions. Please choose another category."],
  ATTEMPT_COMPLETED: [409, "This interview attempt is already complete."],
  ATTEMPT_INCOMPLETE: [
    409,
    "Answer every question before completing this attempt.",
  ],
  PAYLOAD_TOO_LARGE: [413, "The request body exceeds the size limit."],
  UNSUPPORTED_MEDIA_TYPE: [415, "The request content type is not supported."],
  RATE_LIMITED: [429, "Too many requests. Try again later."],
  INTERNAL_ERROR: [500, "Something went wrong. Try again later."],
  SERVICE_UNAVAILABLE: [
    503,
    "The service is temporarily unavailable. Try again later.",
  ],
} as const

export type ApiErrorCode = keyof typeof API_ERRORS
export type FieldErrors = Record<string, string[]>

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  readonly fieldErrors?: FieldErrors
  readonly headers: Headers

  constructor(
    code: ApiErrorCode,
    // Only developer-authored messages; never pass provider errors or submitted values.
    options: {
      fieldErrors?: FieldErrors
      allow?: string[]
      retryAfter?: number
    } = {},
  ) {
    super(API_ERRORS[code][1])
    this.name = "ApiError"
    this.code = code
    this.status = API_ERRORS[code][0]
    this.fieldErrors =
      code === "VALIDATION_ERROR" ? options.fieldErrors : undefined
    this.headers = new Headers()
    if (code === "METHOD_NOT_ALLOWED") {
      if (!options.allow?.length)
        throw new Error("METHOD_NOT_ALLOWED requires Allow.")
      this.headers.set("Allow", options.allow.join(", "))
    }
    if (code === "RATE_LIMITED") {
      if (
        !Number.isSafeInteger(options.retryAfter) ||
        options.retryAfter! < 1
      ) {
        throw new Error(
          "RATE_LIMITED requires a positive Retry-After in seconds.",
        )
      }
      this.headers.set("Retry-After", String(options.retryAfter))
    }
  }
}
