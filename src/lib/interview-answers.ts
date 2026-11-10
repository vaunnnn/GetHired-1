import type { PublicQuestion } from "@gethired/contracts";

export function validPracticeAnswer(question: PublicQuestion, answer: string): boolean {
  if (question.responseDefinition.format === "multiple_choice") {
    return question.responseDefinition.options.some(option => option.id === answer);
  }
  return answer.trim().length >= (question.type === "Candidate Questions" ? 1 : 20) && answer.length <= 20000;
}

export function practiceAnswerText(question: PublicQuestion, answer: string): string {
  return question.responseDefinition.format === "multiple_choice"
    ? question.responseDefinition.options.find(option => option.id === answer)?.text ?? ""
    : answer;
}
