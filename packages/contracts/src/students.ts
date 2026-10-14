export const STUDENT_COURSES = ["BS Computer Science", "BS Information Technology", "BS Information Systems", "BS Data Science"] as const
export const STUDENT_YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"] as const
export interface StudentInput {
  firstName: string
  lastName: string
  email: string
  course: typeof STUDENT_COURSES[number]
  yearLevel: typeof STUDENT_YEARS[number]
}
export interface Student extends StudentInput {
  id: string
  studentNumber: string
  status: "pending" | "active" | "inactive"
}
export interface SignupInput extends StudentInput { password: string }
export interface ChallengeResponse { message: string; challengeId: string }
// Resubmit the chosen password from browser memory after proving ownership.
// Supabase does not replace passwords on repeated unverified signups.
export interface SignupVerification { challengeId: string; code: string; newPassword: string }
