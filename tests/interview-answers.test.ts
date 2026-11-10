import assert from "node:assert/strict";
import { test } from "node:test";
import type { PublicQuestion } from "@gethired/contracts";
import { validPracticeAnswer, practiceAnswerText } from "../src/lib/interview-answers.js";

const question: PublicQuestion = { id: "q", question: "Trace the code", type: "Coding", hint: "",
  responseDefinition: { format: "multiple_choice", options: [{ id: "a", text: "0" }, { id: "b", text: "1" }] } };

test("MCQs require a valid option ID, allow short choices, and display the selected text", () => {
  for (const value of ["", "0", "1", "unknown"]) assert.equal(validPracticeAnswer(question, value), false);
  for (const value of ["a", "b"]) assert.equal(validPracticeAnswer(question, value), true);
  assert.equal(practiceAnswerText(question, "a"), "0");
  assert.equal(practiceAnswerText(question, "b"), "1");
  assert.equal(practiceAnswerText(question, "missing"), "");
});

test("written coding still requires a written response; closing questions allow short text", () => {
  const written: PublicQuestion = { ...question, responseDefinition: { format: "written" } };
  for (const value of ["", " ".repeat(30), "a", "x".repeat(20001)]) assert.equal(validPracticeAnswer(written, value), false);
  const answer = "A solution with supporting reasoning.";
  assert.equal(validPracticeAnswer(written, answer), true);
  assert.equal(practiceAnswerText(written, answer), answer);
  assert.equal(validPracticeAnswer({ ...written, type: "Candidate Questions" }, "No"), true);
});
