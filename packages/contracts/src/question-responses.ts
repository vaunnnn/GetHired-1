/** Answer format is separate from a question's interview phase/type. */
export interface QuestionOption {
  /** Stable within the question; never use the displayed text as an answer ID. */
  id: string
  text: string
}

/** Administrator/evaluator configuration. Never return this union to students. */
export type QuestionResponseDefinition =
  | { format: "written" }
  | { format: "multiple_choice"; options: QuestionOption[]; correctOptionId: string }

/** Student-safe response configuration; excludes the answer key and rubric. */
export type PublicQuestionResponseDefinition =
  | { format: "written" }
  | { format: "multiple_choice"; options: QuestionOption[] }

// Written evaluation criteria remain in Question.feedback (the private rubric).
// Active written questions require a rubric. MCQs must have empty feedback.
export const QUESTION_OPTION_LIMITS = { min: 2, max: 6, id: 40, text: 1000 } as const
export const MCQ_QUESTION_TYPES = ["Technical", "Situational", "Coding"] as const
