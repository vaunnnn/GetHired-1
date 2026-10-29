# Persistent interviews and per-question evaluation

Implemented 2026-10-28 after explicit approval in `MOCK_INTERVIEW_PROGRESS.md`.

Hosted checkpoint 2026-10-29: real authenticated HTTP acceptance through
`https://gethired-1.vercel.app` passed, including four Gemini evaluations, both
MCQ outcomes, persistence, locked submissions and completed history. The six-question
test category is inactive; completed results remain available. Visual browser
acceptance is still pending. See [procedure](hosted-interview-acceptance.md) and
[sanitized evidence](hosted-interview-acceptance-2026-10-29.json). The migration
and rollout notes below describe the original 2026-10-28 checkpoint.

## Student behavior

Selecting a category resumes its unfinished attempt or creates one. Start over abandons
that attempt and creates a fresh selection. Only active bank content is selected;
existing attempts retain their original prompts, choices, rubrics and answer keys.

Written drafts save after 800 ms without typing. MCQ selections save immediately.
Unchanged drafts do not write. Next question flushes the draft and submits it for
evaluation. A submitted answer is locked, including while evaluation is pending or
failed; retry evaluates the same answer. After feedback, Continue advances, or completes
the interview when every question is evaluated. Repeating completion returns the
same result. Starting another interview never changes completed results.

MCQs score 100 or 0, with only Correct/Incorrect feedback. Written answers receive an
integer 0–100 against the snapshotted private rubric. Candidate Questions are included.
The overall score is the equal-weight mean, rounded to two decimal places. Drafts and
failed evaluations have null scores; they cannot count as completed answers.

The tab remembers only the current attempt ID for normal resume. A temporary
sessionStorage copy preserves unsaved text during save failures or interrupted
navigation and is removed after successful saving. It is scoped to the assigned
question and loaded only after the server authorizes the attempt. A revision mismatch
requires explicit reconciliation. Closing the tab clears browser recovery; server-saved
drafts remain. An unload warning protects still-unsaved changes.

## API and privacy

All paths below start with `/api/me/interview-attempts` and require `interviews:own`.
Administrators cannot inspect student attempts. Unknown and other-owned IDs return 404.

| Method/path | Behavior |
| --- | --- |
| `POST /` | `{categoryId, restartAttemptId?}` starts/resumes; returns attempt |
| `GET /?page=1&pageSize=10` | Paginated summaries, newest first |
| `GET /{attemptId}` | Own snapshots, drafts, scores and feedback |
| `PUT /{attemptId}/answers/{questionId}` | `{answer, revision}` saves a draft |
| `POST /{attemptId}/answers/{questionId}/submit` | `{answer, revision}` evaluates once or retries the same failed answer |
| `POST /{attemptId}/complete` | `{}` completes only when all scores exist |

Question IDs refer to assigned snapshots. Owner IDs, scores, feedback and timestamps
are never accepted from the browser. Server validation enforces option membership,
20,000-character maximum, and written minimums of 20 trimmed characters (1 for
Candidate Questions). Blank drafts are allowed. Private keys and rubrics are excluded
from all student DTOs. Response text is rendered as plain text, not HTML.

## Efficiency and concurrency

One current answer row is updated in place; revision numbers do not create revision
history. Snapshots are written once. Indexed owner/category lookups and a partial
unique index enforce one unfinished attempt per category. Start requests serialize
per owner/category. Explicit restarts reference the old attempt, making retries
idempotent. History fetches summaries rather than full answers.

Draft writes read only the target question and check earlier evaluations with EXISTS.
Revision checks reject stale tab writes. Mutations lock the attempt so completion
and answer changes serialize. Written evaluation claims a 60-second lease in a short
authorized transaction, releases the connection before Gemini HTTP, then reauthorizes
to store the result. A crashed/expired evaluation can be retried; token matching
rejects stale results. Repeated requests after success return the stored score.
No background polling, provider calls on keystrokes, or random fallback scores.

## Gemini and hosting

The live-tested default is `gemini-3-flash-preview`. Newer Flash endpoints returned
503 for the configured key; Gemini 2.5 Flash returned 404. The selected model returned
HTTP 200, valid structured feedback and a score in approximately 3 seconds for a
synthetic transaction question. Model access and quotas can change.

Configure these on **Render's API service**, never Vercel or `NEXT_PUBLIC_*`:

```dotenv
GEMINI_API_KEY=<server-only key>
GEMINI_MODEL=gemini-3-flash-preview
GEMINI_REQUESTS_PER_MINUTE=5
GEMINI_REQUESTS_PER_DAY=20
```

Use a Google AI Studio project on the Free tier with billing disabled. The application
cannot inspect or guarantee the Google project's billing state. Its default caps apply
across all students/API instances and may be lower than the project's available quota.
They are configurable; provider limits remain authoritative. No paid fallback is used.
One database budget row resets its counters in place, with no request history growth.
Google lists free-tier input/output for this model and indicates free-tier content may
be used to improve its products. Only the question, rubric, type and answer are sent;
account identifiers, email, other answers and session tokens are omitted.

References: [pricing](https://ai.google.dev/gemini-api/docs/pricing),
[structured output](https://ai.google.dev/gemini-api/docs/structured-output).

The evaluator uses an 18-second timeout, no automatic provider retry, bounded output,
JSON schema and server validation of score/feedback. Truncated, blocked, malformed,
oversized, quota-limited and failed responses produce recoverable errors. Prompt
instructions treat answers as untrusted input; they cannot reliably eliminate every
prompt-injection attempt, so these are practice scores rather than hiring decisions.

## Migration and verification

`202610280001_interview_attempts.sql` was applied directly to documented staging.
Both previous response migrations were already present. All four new tables were
verified and the current backend readiness probe passed with the new schema marker.
The question bank remains empty; no demo content or student attempts were inserted
remotely. Add reviewed content through the admin editor before hosted student testing.

```powershell
$env:NODE_EXTRA_CA_CERTS='D:\GetHired\supabase-ca.crt'
node --env-file=apps/api/.env.local scripts/apply-interview-migration.mjs
node --env-file=apps/api/.env.local --import tsx scripts/verify-gemini.mjs
npm run typecheck
npm run test
npm run build
npm run build:api
$env:CHROME_PATH='C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
node tests/session-browser-smoke.mjs
```

The migration script is read-only without `--apply`, verifies the documented target,
uses verified TLS, and skips the migration when its marker already exists.

Coverage includes PostgreSQL-backed repository tests for ownership, snapshots,
revision conflicts, MCQ scoring, evaluation lease recovery, immutable completion,
quota rejection, history and session expiry. HTTP browser fixtures exercise autosave,
refresh/resume, evaluation retry, scored history and existing application flows.
The synthetic live Gemini check does not send student content. Hosted authenticated
end-to-end acceptance and multi-connection PostgreSQL load testing remain outstanding;
the local Docker daemon was unavailable. Deploy matching frontend and API revisions
after setting Render secrets; this task did not deploy either service.
