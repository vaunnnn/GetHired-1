import type { QuestionResponseDefinition, PublicQuestionResponseDefinition } from "./question-responses.js"

export const QUESTION_TYPES = ["Introduction", "Technical", "Behavioral", "Situational", "Motivational", "Coding", "Design Challenge", "Candidate Questions"] as const
export type QuestionType = typeof QUESTION_TYPES[number]
export interface PhaseConfig { id: string; label: string; shortLabel: string; types: QuestionType[]; count: number }
export const DEFAULT_PHASES: PhaseConfig[] = [
  { id: "intro", label: "Introduction", shortLabel: "Intro", types: ["Introduction"], count: 1 },
  { id: "technical", label: "Technical", shortLabel: "Technical", types: ["Technical"], count: 2 },
  { id: "your-questions", label: "Your Questions", shortLabel: "Q&A", types: ["Candidate Questions"], count: 1 },
]
export interface CategoryInput { name: string; description: string; color: string; bg: string; phases?: PhaseConfig[]; status?: "active" | "inactive" }
export interface Category extends CategoryInput { id: string; phases: PhaseConfig[]; status: "active" | "inactive"; pipeline: string }
export interface QuestionInput { question: string; type: QuestionType; hint: string; feedback: string; status?: "active" | "inactive"; responseDefinition?: QuestionResponseDefinition }
export interface Question extends QuestionInput { id: string; status: "active" | "inactive"; responseDefinition: QuestionResponseDefinition }
export type PublicQuestion = Pick<Question, "id" | "question" | "type" | "hint"> & { responseDefinition: PublicQuestionResponseDefinition }
export interface SelectedPhase { id: string; label: string; shortLabel: string; questions: PublicQuestion[] }
