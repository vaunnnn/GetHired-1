import { randomUUID } from "node:crypto"

import type {
  AttemptAnswer,
  InterviewAttempt,
  AttemptSummary,
  Question,
  QuestionResponseDefinition,
} from "@gethired/contracts"

import type { SqlPool, SqlClient } from "../../auth/store.js"

import type { Principal } from "../../auth/types.js"

import {
  authorizedTransaction,
  type AuthorizationTransaction,
} from "../../db/transaction.js"

import { ApiError } from "../../api/errors.js"

import { selectPipeline } from "./repository.js"

import { publicResponseDefinition } from "./response-definition.js"

import { validateAnswer } from "./attempt-validation.js"

const summaryFields = `id, category_id as "categoryId", category_name as "categoryName", status,
  created_at as "createdAt", completed_at as "completedAt", score::float8 as score`

const saved = (row: Record<string, any>): AttemptAnswer => ({
  answer: row.answer,
  revision: row.revision,
  status: row.answer_status,

  score: row.answer_score,
  feedback: row.feedback,
})

async function owned(c: SqlClient, actor: Principal, id: string, lock = false) {
  const r = await c.query(
    `select ${summaryFields} from gethired_private.interview_attempts where id=$1 and account_id=$2 ${
      lock ? "for update" : "for share"
    }`,
    [id, actor.id],
  )

  if (!r.rows.length) throw new ApiError("NOT_FOUND")

  return r.rows[0] as AttemptSummary
}

async function questions(c: SqlClient, id: string, questionId?: string) {
  return (
    await c.query(
      `select q.*, a.answer, a.revision, a.status as answer_status, a.score as answer_score,
    ${
      questionId
        ? `exists(select 1 from gethired_private.attempt_questions prior
      join gethired_private.attempt_answers pa on pa.question_id=prior.id
      where prior.attempt_id=q.attempt_id and prior.position<q.position and pa.status<>'evaluated') as previous_ungraded,`
        : ""
    }
    a.feedback, a.evaluation_token, a.evaluation_started_at,
    (a.evaluation_started_at > clock_timestamp()-interval '60 seconds') as lease_active
    from gethired_private.attempt_questions q join gethired_private.attempt_answers a on a.question_id=q.id
    where q.attempt_id=$1 ${
      questionId ? "and q.id=$2" : ""
    } order by q.position`,
      questionId ? [id, questionId] : [id],
    )
  ).rows
}

async function detail(
  c: SqlClient,
  summary: AttemptSummary,
): Promise<InterviewAttempt> {
  return {
    ...summary,
    questions: (await questions(c, summary.id)).map((q) => ({
      id: q.id,
      question: q.question,
      type: q.type,

      hint: q.hint,
      phase: q.phase,
      phaseLabel: q.phase_label,
      responseDefinition: publicResponseDefinition(q.response_definition),
      saved: saved(q),
    })),
  }
}

function writable(attempt: AttemptSummary) {
  if (attempt.status !== "in_progress") throw new ApiError("ATTEMPT_COMPLETED")
}

export interface EvaluationWork {
  token: string
  question: string
  type: string
  rubric: string
  answer: string
}

export function createAttemptRepository(pool: SqlPool) {
  const run = <T,>(
    actor: Principal,
    work: (c: SqlClient) => Promise<T>,
    auth?: AuthorizationTransaction,
  ) => authorizedTransaction(pool, actor, "interviews:own", work, auth)

  return {
    start(
      actor: Principal,
      categoryId: string,
      restartAttemptId?: string,
      auth?: AuthorizationTransaction,
    ) {
      return run(
        actor,
        async (c) => {
          await c.query(
            "select pg_advisory_xact_lock(hashtextextended($1, 0))",
            [`interview:${actor.id}:${categoryId}`],
          )

          if (restartAttemptId) {
            const previous = await owned(c, actor, restartAttemptId, true)

            if (previous.categoryId !== categoryId)
              throw new ApiError("NOT_FOUND")

            const replay = await c.query(
              `select ${summaryFields} from gethired_private.interview_attempts where restarted_from=$1 and account_id=$2`,
              [restartAttemptId, actor.id],
            )

            if (replay.rows.length)
              return detail(c, replay.rows[0] as AttemptSummary)
          }

          const existing = await c.query(
            `select ${summaryFields} from gethired_private.interview_attempts where account_id=$1 and category_id=$2 and status='in_progress' for update`,
            [actor.id, categoryId],
          )

          if (
            existing.rows.length &&
            (!restartAttemptId || existing.rows[0].id !== restartAttemptId)
          )
            return detail(c, existing.rows[0] as AttemptSummary)

          const cat = (
            await c.query(
              "select name,phases from gethired_private.categories where id=$1 and status='active' for share",
              [categoryId],
            )
          ).rows[0]

          if (!cat) throw new ApiError("NOT_FOUND")

          const bank = (
            await c.query(
              `select id,question,type,hint,feedback,status,response_definition as "responseDefinition"
          from gethired_private.questions where category_id=$1 and status='active' order by id for share`,
              [categoryId],
            )
          ).rows as Question[]

          const phases = selectPipeline(cat.phases, bank)

          if (existing.rows.length)
            await c.query(
              "update gethired_private.interview_attempts set status='abandoned' where id=$1 and account_id=$2",
              [restartAttemptId, actor.id],
            )

          const attempt = (
            await c.query(
              `insert into gethired_private.interview_attempts(account_id,category_id,category_name,restarted_from)
          values ($1,$2,$3,$4) returning ${summaryFields}`,
              [actor.id, categoryId, cat.name, restartAttemptId ?? null],
            )
          ).rows[0] as AttemptSummary

          const snapshots = phases
            .flatMap((p) =>
              p.questions.map((q) => {
                const original = bank.find((b) => b.id === q.id)!

                return {
                  id: randomUUID(),
                  source_id: q.id,
                  phase: p.id,
                  phase_label: p.label,
                  question: q.question,
                  type: q.type,

                  hint: q.hint,
                  rubric: original.feedback,
                  response_definition: original.responseDefinition,
                }
              }),
            )
            .map((q, position) => ({ ...q, position }))

          await c.query(
            `insert into gethired_private.attempt_questions(id,attempt_id,source_id,position,phase,phase_label,question,type,hint,rubric,response_definition)
          select x.id,$1,x.source_id,x.position,x.phase,x.phase_label,x.question,x.type,x.hint,x.rubric,x.response_definition
          from jsonb_to_recordset($2::jsonb) as x(id uuid,source_id uuid,position int,phase text,phase_label text,question text,type text,hint text,rubric text,response_definition jsonb)`,
            [attempt.id, JSON.stringify(snapshots)],
          )

          await c.query(
            "insert into gethired_private.attempt_answers(question_id) select id from gethired_private.attempt_questions where attempt_id=$1",
            [attempt.id],
          )

          return detail(c, attempt)
        },
        auth,
      )
    },

    get(actor: Principal, id: string, auth?: AuthorizationTransaction) {
      return run(actor, async (c) => detail(c, await owned(c, actor, id)), auth)
    },

    list(
      actor: Principal,
      page: number,
      pageSize: number,
      auth?: AuthorizationTransaction,
    ) {
      return run(
        actor,
        async (c) => {
          const rows = await c.query(
            `select ${summaryFields} from gethired_private.interview_attempts where account_id=$1
          order by created_at desc,id desc limit $2 offset $3`,
            [actor.id, pageSize, (page - 1) * pageSize],
          )

          const count = await c.query(
            "select count(*)::int as total from gethired_private.interview_attempts where account_id=$1",
            [actor.id],
          )

          return {
            data: rows.rows as AttemptSummary[],
            meta: { page, pageSize, total: count.rows[0].total },
          }
        },
        auth,
      )
    },

    save(
      actor: Principal,
      id: string,
      questionId: string,
      answer: string,
      revision: number,
      auth?: AuthorizationTransaction,
    ) {
      return run(
        actor,
        async (c) => {
          const attempt = await owned(c, actor, id, true)
          writable(attempt)

          const q = (await questions(c, id, questionId))[0]

          if (!q) throw new ApiError("NOT_FOUND")

          validateAnswer(q.response_definition, q.type, answer, false)

          if (q.answer_status !== "draft") throw new ApiError("ANSWER_LOCKED")

          if (q.answer === answer) return saved(q)

          if (q.revision !== revision) throw new ApiError("ANSWER_CONFLICT")

          if (q.previous_ungraded) throw new ApiError("ATTEMPT_INCOMPLETE")

          await c.query(
            `update gethired_private.attempt_answers set answer=$2,revision=revision+1,updated_at=clock_timestamp() where question_id=$1`,
            [questionId, answer],
          )

          return { ...saved(q), answer, revision: revision + 1 }
        },
        auth,
      )
    },

    claim(
      actor: Principal,
      id: string,
      questionId: string,
      answer: string,
      revision: number,
      limits: { minute: number; day: number },
    ) {
      return run(actor, async (c) => {
        const attempt = await owned(c, actor, id, true)

        const q = (await questions(c, id, questionId))[0]

        if (!q) throw new ApiError("NOT_FOUND")

        if (q.answer_status === "evaluated" && q.answer === answer)
          return { result: saved(q) }

        writable(attempt)

        if (
          q.answer_status === "evaluated" ||
          (q.answer_status !== "draft" && q.answer !== answer)
        )
          throw new ApiError("ANSWER_LOCKED")

        if (q.answer_status === "evaluating" && q.lease_active)
          throw new ApiError("EVALUATION_PENDING")

        if (q.revision !== revision) throw new ApiError("ANSWER_CONFLICT")

        validateAnswer(q.response_definition, q.type, answer, true)

        if (q.previous_ungraded) throw new ApiError("ATTEMPT_INCOMPLETE")

        const definition = q.response_definition as QuestionResponseDefinition

        if (definition.format === "multiple_choice") {
          const score = answer === definition.correctOptionId ? 100 : 0

          const feedback = score === 100 ? "Correct." : "Incorrect."

          await c.query(
            `update gethired_private.attempt_answers set answer=$2,revision=revision+1,status='evaluated',score=$3,feedback=$4,
            evaluation_model='answer-key',evaluation_version='mcq-v1',updated_at=clock_timestamp() where question_id=$1`,
            [questionId, answer, score, feedback],
          )

          return {
            result: {
              answer,
              revision: revision + 1,
              status: "evaluated" as const,
              score,
              feedback,
            },
          }
        }

        // One global row bounds provider usage across instances; failed requests count too.

        await c.query(
          `insert into gethired_private.interview_evaluation_budget values ('gemini',date_trunc('minute',clock_timestamp()),0,(clock_timestamp() at time zone 'UTC')::date,0) on conflict do nothing`,
        )

        const budget = await c.query(
          `update gethired_private.interview_evaluation_budget set
          minute_count=case when minute_start=date_trunc('minute',clock_timestamp()) then minute_count+1 else 1 end,
          day_count=case when day_start=(clock_timestamp() at time zone 'UTC')::date then day_count+1 else 1 end,
          minute_start=date_trunc('minute',clock_timestamp()),day_start=(clock_timestamp() at time zone 'UTC')::date
          where scope='gemini' and (minute_start<>date_trunc('minute',clock_timestamp()) or minute_count<$1)
          and (day_start<>(clock_timestamp() at time zone 'UTC')::date or day_count<$2) returning scope`,
          [limits.minute, limits.day],
        )

        if (!budget.rows.length) throw new ApiError("EVALUATION_QUOTA")

        const token = randomUUID()

        await c.query(
          `update gethired_private.attempt_answers set answer=$2,revision=revision+case when answer=$2 then 0 else 1 end,
          status='evaluating',evaluation_token=$3,evaluation_started_at=clock_timestamp(),updated_at=clock_timestamp() where question_id=$1`,
          [questionId, answer, token],
        )

        return {
          work: {
            token,
            question: q.question,
            type: q.type,
            rubric: q.rubric,
            answer,
          } as EvaluationWork,
        }
      })
    },

    settle(
      actor: Principal,
      id: string,
      questionId: string,
      token: string,
      evaluation: { score: number; feedback: string; model: string } | null,
    ) {
      return run(actor, async (c) => {
        const attempt = await owned(c, actor, id, true)
        writable(attempt)

        const row = (await questions(c, id, questionId))[0]

        if (!row) throw new ApiError("NOT_FOUND")

        if (
          row.evaluation_token !== token ||
          row.answer_status !== "evaluating"
        )
          throw new ApiError("CONFLICT")

        await c.query(
          `update gethired_private.attempt_answers set status=$2,score=$3,feedback=$4,evaluation_model=$5,
          evaluation_version='written-v1',evaluation_token=null,updated_at=clock_timestamp() where question_id=$1`,

          [
            questionId,
            evaluation ? "evaluated" : "failed",
            evaluation?.score ?? null,
            evaluation?.feedback ?? null,
            evaluation?.model ?? null,
          ],
        )

        return {
          ...saved(row),
          status: evaluation ? "evaluated" as const : "failed" as const,
          score: evaluation?.score ?? null,
          feedback: evaluation?.feedback ?? null,
        }
      })
    },

    complete(actor: Principal, id: string, auth?: AuthorizationTransaction) {
      return run(
        actor,
        async (c) => {
          const attempt = await owned(c, actor, id, true)

          if (attempt.status === "completed") return detail(c, attempt)

          writable(attempt)

          const rows = await questions(c, id)

          if (!rows.length || rows.some((q) => q.answer_status !== "evaluated"))
            throw new ApiError("ATTEMPT_INCOMPLETE")

          const score =
            Math.round(
              (rows.reduce((sum, q) => sum + q.answer_score, 0) / rows.length) *
                100,
            ) / 100

          const updated = (
            await c.query(
              `update gethired_private.interview_attempts set status='completed',score=$2,completed_at=clock_timestamp() where id=$1 and account_id=$3 returning ${summaryFields}`,
              [id, score, actor.id],
            )
          ).rows[0]

          return detail(c, updated as AttemptSummary)
        },
        auth,
      )
    },
  }
}
