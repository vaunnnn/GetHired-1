import { randomInt } from "node:crypto"
import type { Category, Question, SelectedPhase, PhaseConfig } from "@gethired/contracts"
import type { SqlPool, SqlClient } from "../../auth/store.js"
import type { Principal } from "../../auth/types.js"
import { authorizedTransaction, type AuthorizationTransaction } from "../../db/transaction.js"
import { appendAudit } from "../../db/events.js"
import { ApiError } from "../../api/errors.js"
import { DEFAULT_PHASES, questionInput, type bankQuery } from "./validation.js"
import { publicResponseDefinition } from "./response-definition.js"
const categoryFields = "id,name,description,color,bg,phases,status"
const questionFields = 'id,question,type,hint,feedback,status,response_definition as "responseDefinition"'
const categoryDto = (row: Category): Category => ({ ...row, pipeline: row.phases.map(p => p.shortLabel).join(" → ") })
export function selectPipeline(phases: PhaseConfig[], questions: Question[]): SelectedPhase[] {
  const used = new Set<string>()
  return phases.map(phase => {
    const candidates = questions.filter(q => q.status === "active" && phase.types.includes(q.type) && !used.has(q.id))
    if (candidates.length < phase.count) throw new ApiError("CATEGORY_UNAVAILABLE")
    const selected = Array.from({ length: phase.count }, () => {
      const q = candidates.splice(randomInt(candidates.length), 1)[0]; used.add(q.id)
      return { id: q.id, question: q.question, type: q.type, hint: q.hint, responseDefinition: publicResponseDefinition(q.responseDefinition) }
    })
    return { id: phase.id, label: phase.label, shortLabel: phase.shortLabel, questions: selected }
  })
}
async function category(client: SqlClient, id: string, active = false) {
  const result = await client.query(`select ${categoryFields} from gethired_private.categories where id=$1 ${active ? "and status='active'" : ""} for share`, [id])
  if (!result.rows.length) throw new ApiError("NOT_FOUND")
  return categoryDto(result.rows[0] as Category)
}
export function createBankRepository(pool: SqlPool) {
  return {
    list(actor: Principal, query: ReturnType<typeof bankQuery>, admin: boolean, categoryId?: string, authorization?: AuthorizationTransaction) {
      return authorizedTransaction(pool, actor, admin || categoryId ? "questions:write" : "categories:read", async client => {
        if (categoryId) await category(client, categoryId)
        const status = admin ? query.status ?? null : "active"
        const result = await client.query(`with matches as (select ${categoryId ? questionFields : categoryFields}
          from gethired_private.${categoryId ? "questions" : "categories"} where ($1::text is null or status=$1)
          ${categoryId ? "and category_id=$4" : ""}), page as (select * from matches order by ${categoryId ? "id" : "name,id"} limit $2 offset $3)
          select (select count(*)::int from matches) as total, coalesce((select json_agg(page order by ${categoryId ? "id" : "name,id"}) from page),'[]'::json) as data`,
        [status, query.pageSize, (query.page - 1) * query.pageSize, ...(categoryId ? [categoryId] : [])])
        const row = result.rows[0]
        return { data: categoryId ? row.data as Question[] : row.data.map(categoryDto) as Category[], meta: { page: query.page, pageSize: query.pageSize, total: row.total } }
      }, authorization)
    },
    save(actor: Principal, requestId: string, input: Record<string, unknown>, kind: "category" | "question", id?: string, categoryId?: string, authorization?: AuthorizationTransaction) {
      return authorizedTransaction(pool, actor, "questions:write", async client => {
        const table = kind === "category" ? "categories" : "questions"
        if (categoryId) await category(client, categoryId)
        let current: Record<string, unknown> = {}
        if (id) {
          const locked = await client.query(`select ${kind === "question" ? questionFields : "id"} from gethired_private.${table} where id=$1 for update`, [id])
          if (!locked.rows.length) throw new ApiError("NOT_FOUND")
          if (kind === "question") { const { id: _id, ...fields } = locked.rows[0]; current = fields }
        }
        // Revalidate a PATCH against the locked current record, so type/status or
        // rubric edits cannot leave an invalid MCQ or activate an incomplete draft.
        const validated = kind === "question" ? questionInput({ ...current, ...input }) : input
        const data = { ...validated, ...(!id && kind === "category" ? { phases: input.phases ?? DEFAULT_PHASES } : {}), ...(categoryId ? { category_id: categoryId } : {}) }
        const entries = Object.entries(data).map(([key, value]) => [key === "responseDefinition" ? "response_definition" : key, value] as const)
        const values = entries.map(([k,v]) => ["phases", "response_definition"].includes(k) ? JSON.stringify(v) : v)
        const result = await client.query(id ? `update gethired_private.${table} set ${entries.map(([k], i) => `${k}=$${i+1}`).join(",")},updated_at=clock_timestamp() where id=$${values.length+1} returning ${kind === "category" ? categoryFields : questionFields}`
          : `insert into gethired_private.${table} (${entries.map(([k]) => k).join(",")}) values (${values.map((_,i) => `$${i+1}`).join(",")}) returning ${kind === "category" ? categoryFields : questionFields}`, [...values, ...(id ? [id] : [])])
        const row = result.rows[0]
        await appendAudit(client, { actorId: actor.id, requestId, action: `${kind}.${id ? "updated" : "created"}`, resourceType: kind, resourceId: row.id })
        return kind === "category" ? categoryDto(row as Category) : row as Question
      }, authorization)
    },
    pipeline(actor: Principal, id: string, authorization?: AuthorizationTransaction) {
      return authorizedTransaction(pool, actor, "categories:read", async client => {
        const cat = await category(client, id, true)
        const rows = await client.query(`select id,question,type,hint,status,response_definition as "responseDefinition" from gethired_private.questions where category_id=$1 and status='active' order by id for share`, [id])
        return selectPipeline(cat.phases, rows.rows as Question[])
      }, authorization)
    },
  }
}
