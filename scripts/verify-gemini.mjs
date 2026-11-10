// Synthetic prompt only; never prints the key, provider diagnostics, or student content.
import {
  evaluateWritten,
  evaluationConfig,
} from "../apps/api/src/modules/interviews/evaluation.ts"
try {
  const started = performance.now()
  const result = await evaluateWritten(
    {
      token: "verification",
      question: "Explain what a database transaction does.",
      type: "Technical",
      rubric:
        "Explain atomicity and how commit and rollback protect related updates.",
      answer:
        "A transaction groups related database updates into an atomic unit. Commit persists all changes; rollback discards them so partial updates are not left behind.",
    },
    evaluationConfig(),
    async (...args) => {
      try {
        const response = await fetch(...args)
        const copy = await response.clone().json()
        console.log(
          JSON.stringify({
            providerStatus: response.status,
            providerCode: copy.error?.status,
            finishReason: copy.candidates?.[0]?.finishReason,
          }),
        )
        return response
      } catch (e) {
        console.log(JSON.stringify({ transportError: e.name }))
        throw e
      }
    },
  )
  console.log(
    JSON.stringify({
      ok: true,
      model: result.model,
      score: result.score,
      feedbackPresent: !!result.feedback,
      durationMs: Math.round(performance.now() - started),
    }),
  )
} catch (e) {
  console.log(JSON.stringify({ ok: false, code: e.code ?? e.name }))
  process.exitCode = 1
}
