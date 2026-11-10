# Hosted interview acceptance

Target frontend: `https://gethired-1.vercel.app`.
Target API: `https://gethired-113w.onrender.com`.

2026-10-29 result: HTTP acceptance passed. Four written evaluations scored 100;
the correct and incorrect MCQs scored 100 and 0; the persisted overall score
was 83.33. The category is inactive, its completed attempt remains readable,
and both test sessions were logged out. See
[sanitized evidence](hosted-interview-acceptance-2026-10-29.json).

## Reusable HTTP harness

`scripts/hosted-interview-acceptance.mjs` exports `acceptanceQuestions` and
`runHostedAcceptance(request, report, onProgress)`. Importing the module performs
no network calls or writes. Invoke it only with approval to create a category,
six questions and a student attempt in staging, and to send its four synthetic
written answers to the configured Gemini evaluator.

The caller supplies a request function with signature
`request(role, path, method = "GET", body)` returning the HTTP status plus parsed
JSON envelope. Use separate administrator and student cookie jars, the exact
frontend origin, JSON bodies, and CSRF headers. Authenticate through the normal
login endpoint. Fetch a fresh CSRF token after login or refresh because the
session binding rotates. Never record credentials, tokens or cookie values.
Do not bypass authentication or create sessions directly in the database.

Pass an initially empty report object (with the target origin) and a progress
callback. Retain the report even if the harness throws. The harness populates a
new, initially inactive category, activates it only after all questions exist,
and deactivates it in `finally`. A network or session failure during cleanup must
be resolved through the admin interface; verify the category is inactive.
It does not edit existing categories or delete attempts/results.

For interrupted setup before an attempt is created, passing the prior
`report.categoryId` reuses that acceptance category after checking its label
and all six stored definitions. Do not use this setup recovery path to resume
a partly graded attempt; inspect that attempt and plan recovery separately.
If running in a persistent REPL, collect progress messages in an array while
background work runs, then print them from an active tool call.

The content includes four written questions with private rubrics and two MCQs.
One MCQ is answered correctly and one incorrectly. Technical question ordering
is randomized by the real application; answers are matched by prompt.
Four successful written submissions consume four provider requests. Replaying
an already evaluated submission must return its stored result. The harness does
not intentionally exhaust quotas or force provider outages.

Checks cover persisted content, private-definition projection, administrator
denial of student attempts, incomplete completion rejection, automatic resume,
draft persistence, unchanged saves, stale revision rejection, blank submission
rejection, real written evaluation, MCQ grading, locked answers, replay,
equal-weight overall scoring, immutable completion and saved history.

## Browser acceptance still required

HTTP acceptance reaches the real frontend proxy, API, database and evaluator,
but does not verify rendered controls or browser event handling.

With an approved staging category temporarily active:

1. Sign in as the student and open the category.
2. Type a synthetic answer, wait for the saved indicator, refresh, and verify
   the answer and current question resume correctly.
3. Submit written and MCQ answers. Confirm feedback appears before Continue,
   answers cannot be edited afterward, and the next question is selectable.
4. Complete the interview, open saved history, and verify answers, feedback
   and the overall score persist after another refresh.
5. Sign out. As administrator, deactivate the test category again and verify
   it is absent from student category selection.

A safe local fixture test covers simulated evaluation failure/retry. Hosted
provider failure recovery is not proven merely by successful live evaluations.
Record that distinction, and keep multi-connection load testing as its separate
tracker task. No second student identity is provisioned by this harness, so
cross-student ownership isolation remains covered by repository tests unless
separately exercised with another authorized test account.
