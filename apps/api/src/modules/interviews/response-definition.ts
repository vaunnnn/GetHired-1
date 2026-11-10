import {
  QUESTION_OPTION_LIMITS,
  type QuestionResponseDefinition,
  type PublicQuestionResponseDefinition,
} from "@gethired/contracts"
import { ApiError } from "../../api/errors.js"
import { oneOf, strictObject, text } from "../../api/validation.js"

/** Validate the entire configuration together, including on future PATCHes. */
export function responseDefinition(value: unknown): QuestionResponseDefinition {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError("VALIDATION_ERROR")
  const format = oneOf(["written", "multiple_choice"] as const)((value as Record<string, unknown>).format)
  if (format === "written") return { ...strictObject(value, { format: oneOf(["written"] as const) }) }

  const parsed = strictObject(value, {
    format: oneOf(["multiple_choice"] as const),
    options: (items: unknown) => {
      if (!Array.isArray(items) || items.length < QUESTION_OPTION_LIMITS.min || items.length > QUESTION_OPTION_LIMITS.max)
        throw new ApiError("VALIDATION_ERROR")
      const ids = new Set<string>(), labels = new Set<string>()
      return items.map(item => {
        const option = strictObject(item, {
          id: (id: unknown) => {
            if (typeof id !== "string" || !/^[a-z][a-z0-9_-]{0,39}$/.test(id)) throw new ApiError("VALIDATION_ERROR")
            return id
          },
          text: text(1, QUESTION_OPTION_LIMITS.text),
        })
        const label = option.text.toLowerCase()
        if (ids.has(option.id) || labels.has(label)) throw new ApiError("VALIDATION_ERROR")
        ids.add(option.id); labels.add(label)
        return { ...option }
      })
    },
    correctOptionId: text(1, QUESTION_OPTION_LIMITS.id),
  })
  if (!parsed.options.some(option => option.id === parsed.correctOptionId))
    throw new ApiError("VALIDATION_ERROR")
  return { ...parsed }
}

/** Explicit projection prevents future student payloads from leaking answer keys. */
export function publicResponseDefinition(value: QuestionResponseDefinition): PublicQuestionResponseDefinition {
  return value.format === "written" ? { format: "written" } : {
    format: "multiple_choice",
    options: value.options.map(option => ({ id: option.id, text: option.text })),
  }
}
