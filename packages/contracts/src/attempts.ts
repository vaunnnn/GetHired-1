import type { PublicQuestion } from "./interviews.js"

export type AttemptStatus = "in_progress" | "completed" | "abandoned"
export type AnswerStatus = "draft" | "evaluating" | "failed" | "evaluated"
export interface AttemptAnswer {
  answer: string
  revision: number
  status: AnswerStatus
  score: number | null
  feedback: string | null
}
export interface AttemptQuestion extends PublicQuestion {
  phase: string
  phaseLabel: string
  saved: AttemptAnswer
}
export interface AttemptSummary {
  id: string
  categoryId: string
  categoryName: string
  status: AttemptStatus
  createdAt: string
  completedAt: string | null
  score: number | null
}
export interface InterviewAttempt extends AttemptSummary {
  questions: AttemptQuestion[]
}
