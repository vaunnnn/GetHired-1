import { createApiRoute, type ApiContext } from "../../api/route.js"
import { ApiError } from "../../api/errors.js"
import { strictObject, uuid } from "../../api/validation.js"
import { getDatabasePool } from "../../auth/runtime.js"
import { createAttemptRepository } from "./attempt-repository.js"
import { answerInput, attemptQuery, startInput } from "./attempt-validation.js"
import { evaluateWritten, evaluationConfig } from "./evaluation.js"

const actor = (c: ApiContext) => {
  if (!c.actor?.auth) throw new ApiError("UNAUTHENTICATED")
  return c.actor.auth
}
const repo = () => createAttemptRepository(getDatabasePool())
export function attemptRoutes() {
  const routes = new Map<string, ReturnType<typeof createApiRoute>>()
  const base = "/api/me/interview-attempts"
  const access = {
    kind: "protected",
    permission: "interviews:own",
    transaction: "business",
  } as const
  routes.set(
    base,
    createApiRoute({
      route: base,
      access,
      methods: {
        GET: {
          body: "none",
          handle: (c) => {
            const q = attemptQuery(new URL(c.request.url).searchParams)
            return repo().list(actor(c), q.page, q.pageSize, c.authorization)
          },
        },
        POST: {
          body: "json",
          handle: async (c) => {
            const input = startInput(c.body)
            return {
              data: await repo().start(
                actor(c),
                input.categoryId,
                input.restartAttemptId,
                c.authorization,
              ),
            }
          },
        },
      },
    }),
  )
  const detail = `${base}/[attemptId]`
  routes.set(
    detail,
    createApiRoute({
      route: detail,
      access,
      methods: {
        GET: {
          body: "none",
          handle: async (c) => ({
            data: await repo().get(
              actor(c),
              uuid(c.params.attemptId),
              c.authorization,
            ),
          }),
        },
      },
    }),
  )
  const answer = `${detail}/answers/[questionId]`
  routes.set(
    answer,
    createApiRoute({
      route: answer,
      access,
      methods: {
        PUT: {
          body: "json",
          handle: async (c) => {
            const input = answerInput(c.body)
            return {
              data: await repo().save(
                actor(c),
                uuid(c.params.attemptId),
                uuid(c.params.questionId),
                input.answer,
                input.revision,
                c.authorization,
              ),
            }
          },
        },
      },
    }),
  )
  const submit = `${answer}/submit`
  // Separate short authorized transactions before/after the provider call. No DB lease held during HTTP.
  routes.set(
    submit,
    createApiRoute({
      route: submit,
      access: { kind: "protected", permission: "interviews:own" },
      methods: {
        POST: {
          body: "json",
          handle: async (c) => {
            const input = answerInput(c.body),
              principal = actor(c),
              id = uuid(c.params.attemptId),
              qid = uuid(c.params.questionId)
            const repository = repo(),
              config = evaluationConfig()
            const claim = await repository.claim(
              principal,
              id,
              qid,
              input.answer,
              input.revision,
              config,
            )
            if (claim.result) return { data: claim.result }
            let evaluation
            try {
              evaluation = await evaluateWritten(claim.work!, config)
            } catch (error) {
              await repository.settle(
                principal,
                id,
                qid,
                claim.work!.token,
                null,
              )
              throw error
            }
            return {
              data: await repository.settle(
                principal,
                id,
                qid,
                claim.work!.token,
                evaluation,
              ),
            }
          },
        },
      },
    }),
  )
  const complete = `${detail}/complete`
  routes.set(
    complete,
    createApiRoute({
      route: complete,
      access,
      methods: {
        POST: {
          body: "json",
          handle: async (c) => {
            strictObject(c.body, {})
            return {
              data: await repo().complete(
                actor(c),
                uuid(c.params.attemptId),
                c.authorization,
              ),
            }
          },
        },
      },
    }),
  )
  return routes
}
