import type { Student, StudentInput } from "@gethired/contracts"
import type { QueryResultRow } from "pg"
import { ApiError } from "../../api/errors.js"
import type { SqlPool } from "../../auth/store.js"
import type { Principal } from "../../auth/types.js"
import { authorizedTransaction } from "../../db/transaction.js"
import { appendAudit } from "../../db/events.js"
import type { studentPatch, studentQuery } from "./input.js"

const select = `select a.id, a.email, a.status, p.student_number, p.first_name, p.last_name, p.course, p.year_level
  from gethired_private.accounts a join gethired_private.student_profiles p on p.account_id = a.id`
const project = (r: QueryResultRow): Student => ({ id: r.id, email: r.email, status: r.status, studentNumber: r.student_number,
  firstName: r.first_name, lastName: r.last_name, course: r.course, yearLevel: r.year_level })
export function createStudentRepository(pool: SqlPool) {
  return {
    list(actor: Principal, query: ReturnType<typeof studentQuery>) {
      return authorizedTransaction(pool, actor, "students:manage", async c => {
        const where = ` where a.role = 'student' and ($1 = '' or position(lower($1) in lower(a.email || ' ' || p.first_name || ' ' || p.last_name)) > 0)
          and ($2::text is null or p.course = $2) and ($3::text is null or a.status = $3)`
        const values = [query.q, query.course ?? null, query.status ?? null]
        const count = await c.query(`select count(*)::integer as total from gethired_private.accounts a join gethired_private.student_profiles p on p.account_id = a.id${where}`, values)
        const rows = await c.query(`${select}${where} order by p.last_name, p.first_name, a.id limit $4 offset $5`, [...values, query.pageSize, (query.page - 1) * query.pageSize])
        return { data: rows.rows.map(project), meta: { page: query.page, pageSize: query.pageSize, total: count.rows[0].total } }
      })
    },
    create(actor: Principal, requestId: string, input: StudentInput) {
      return authorizedTransaction(pool, actor, "students:manage", async c => {
        await c.query("select pg_advisory_xact_lock(hashtextextended($1, 5))", [input.email])
        if ((await c.query("select id from gethired_private.accounts where lower(email) = $1", [input.email])).rows.length) throw new ApiError("CONFLICT")
        const result = await c.query("select gethired_private.create_pending_student($1,$2,$3,$4,$5) as id", [input.email, input.firstName, input.lastName, input.course, input.yearLevel])
        const id = result.rows[0].id
        await appendAudit(c, { actorId: actor.id, requestId, action: "student.created", resourceType: "student", resourceId: id })
        return project((await c.query(`${select} where a.id = $1`, [id])).rows[0])
      })
    },
    patch(actor: Principal, requestId: string, id: string, input: ReturnType<typeof studentPatch>) {
      return authorizedTransaction(pool, actor, "students:manage", async c => {
        const email = (await c.query("select email from gethired_private.accounts where id = $1 and role = 'student'", [id])).rows[0]?.email
        if (!email) throw new ApiError("NOT_FOUND")
        await c.query("select pg_advisory_xact_lock(hashtextextended($1, 5))", [email])
        const account = (await c.query("select * from gethired_private.accounts where id = $1 and role = 'student' for update", [id])).rows[0]
        if (!account) throw new ApiError("NOT_FOUND")
        // Only verified, provisioned accounts can be reactivated. Pending requires setup.
        if (input.status && (account.status === "pending" || !account.auth_user_id)) throw new ApiError("CONFLICT")
        await c.query(`update gethired_private.student_profiles set first_name = coalesce($2,first_name), last_name = coalesce($3,last_name),
          course = coalesce($4,course), year_level = coalesce($5,year_level) where account_id = $1`,
        [id, input.firstName ?? null, input.lastName ?? null, input.course ?? null, input.yearLevel ?? null])
        await c.query(`update gethired_private.accounts a set display_name = p.first_name || ' ' || p.last_name, status = coalesce($2, a.status)
          from gethired_private.student_profiles p where a.id = $1 and p.account_id = a.id`, [id, input.status ?? null])
        if (input.status) await c.query(`update gethired_private.onboarding_operations set state = 'superseded', profile = null, provider_credential = null
          where account_id = $1 and state not in ('completed','superseded')`, [id])
        await appendAudit(c, { actorId: actor.id, requestId, action: "student.updated", resourceType: "student", resourceId: id })
        return project((await c.query(`${select} where a.id = $1`, [id])).rows[0])
      })
    },
  }
}
