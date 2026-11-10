import { ApiError } from "../../api/errors.js"
import {
  optional,
  strictObject,
  uuid,
  pagination,
} from "../../api/validation.js"
import type { QuestionResponseDefinition } from "@gethired/contracts"

export const startInput = (value: unknown) =>
  strictObject(value, {
    categoryId: uuid,
    restartAttemptId: optional(uuid),
  })
export const answerInput = (value: unknown) =>
  strictObject(value, {
    answer: (v: unknown) => {
      if (typeof v !== "string" || v.length > 20000 || v.includes("\0"))
        throw new ApiError("VALIDATION_ERROR")
      return v
    },
    revision: (v: unknown) => {
      if (!Number.isSafeInteger(v) || v as number < 0)
        throw new ApiError("VALIDATION_ERROR")
      return v as number
    },
  })
export function validateAnswer(
  definition: QuestionResponseDefinition,
  type: string,
  answer: string,
  final: boolean,
) {
  if (definition.format === "multiple_choice") {
    if (
      (!final && answer === "") ||
      definition.options.some((o) => o.id === answer)
    )
      return
  } else if (
    definition.format === "written" &&
    (!final ||
      answer.trim().length >= (type === "Candidate Questions" ? 1 : 20))
  )
    return
  throw new ApiError("VALIDATION_ERROR")
}
export function attemptQuery(params: URLSearchParams) {
  for (const key of params.keys())
    if (!["page", "pageSize"].includes(key) || params.getAll(key).length !== 1)
      throw new ApiError("VALIDATION_ERROR")
  return pagination(params)
}
