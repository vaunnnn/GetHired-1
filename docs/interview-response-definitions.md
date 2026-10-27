# Interview response definitions

Implemented on 2026-10-27: response formats are connected to question CRUD, the administrator editor, and student practice. Both response migrations have been applied to the configured, documented staging Supabase project. Grading, persistent attempts, and Gemini evaluation remain subsequent milestones.

## Formats

Question `type` still identifies its subject/phase (Technical, Behavioral, Coding, etc.). The separate `response_definition` database column, exposed as `responseDefinition` in the API, describes how it is answered. Technical, Situational, and Coding allow both formats. All other question types are written only. Phase counts and random selection are unchanged; there is no guaranteed written/MCQ ratio.

Written response:

```json
{ "format": "written" }
```

The existing private `questions.feedback` field holds written evaluation criteria. Authors should specify what a satisfactory response must cover, evidence of correctness or reasoning, and relevant omissions or misconceptions. These are evaluator instructions, not a prewritten evaluation of the student's answer. Active written questions require nonblank criteria; inactive drafts may have blank criteria. Written Coding questions ask for a solution and its reasoning. This task does not establish numeric score weights or Gemini prompts.

Single-answer multiple choice:

```json
{
  "format": "multiple_choice",
  "options": [
    { "id": "a", "text": "HTTP 200" },
    { "id": "b", "text": "HTTP 404" }
  ],
  "correctOptionId": "b"
}
```

- Two to six options; exactly one correct option ID belonging to that list.
- IDs start with a lowercase letter and contain only lowercase letters, digits, underscores, or hyphens (maximum 40 characters).
- Option text contains 1–1,000 characters after trimming. IDs and case-insensitive trimmed labels must be unique.
- Unknown fields and mixed written/MCQ configurations are rejected.
- Student practice records the stable option ID and displays its text. Server answer submission is a later task.
- MCQs must have empty `feedback`: explanations are prohibited. No explanation input is presented to administrators or students for MCQs.
- Coding MCQs can cover code tracing and debugging; written Coding remains available for complex solutions and reasoning.
- `publicResponseDefinition()` copies only the format and display options. Never send `correctOptionId` or the private rubric in a student prompt.

## Migration and integration

`supabase/migrations/202610270001_question_response_definitions.sql` adds a constrained JSONB column to the existing questions table. Existing questions default to written responses. `202610270002_question_response_rules.sql` enforces the permitted MCQ types, forbids MCQ explanations, and requires active written rubrics. Existing active written questions with blank rubrics become inactive drafts; content is retained. Both migrations follow B6 and are operator-run.

Question POST accepts optional `responseDefinition` (defaults to written for legacy clients). Question PATCH may replace the complete configuration. The repository merges edits with the locked current record and validates the result, including status-only and type-only edits. Admin reads include the answer key; student pipeline responses include only format/options. Written rubrics never enter student payloads. New definitions preserve stable option IDs while editing and removing choices.

The API readiness marker requires `202610270002`; apply migrations before deploying this API. The bounded runner checks the documented staging target and skips already applied versions:

```powershell
$env:NODE_EXTRA_CA_CERTS = (Resolve-Path 'supabase-ca.crt').Path
node --env-file=apps/api/.env.local scripts/apply-question-response-migrations.mjs
node --env-file=apps/api/.env.local scripts/apply-question-response-migrations.mjs --apply
```

On 2026-10-27 both migrations succeeded. The target contained zero questions at migration time; no question content or test accounts were added to hosted Supabase. Populate the bank through the administrator interface or the separately reviewed seed procedure.

## Local verification

```powershell
node --import tsx --test apps/api/tests/question-response-definitions.test.ts apps/api/tests/b6-question-bank.test.ts tests/interview-answers.test.ts
npm.cmd run typecheck
```

Tests cover bank persistence, private rubric handling, inactive/short banks, seed preservation, stored MCQ constraints, answer-key projection, format changes, partial-edit validation, and local answer handling. The browser smoke includes written responses, Coding MCQ selection/retry/completion, and administrator MCQ editing with no explanation field.

Run browser acceptance against an isolated build so the running development server keeps its own artifacts:

```powershell
$env:GETHIRED_BUILD_DIR = '.next-smoke'
npm.cmd run build
node tests/session-browser-smoke.mjs
```
