import { COMPANY_NICHES, type Company, type CompanyInput, type Bookmark } from "@gethired/contracts"
import type { SqlPool, SqlClient } from "../../auth/store.js"
import type { Principal } from "../../auth/types.js"
import { authorizedTransaction } from "../../db/transaction.js"
import { appendAudit } from "../../db/events.js"
import { ApiError } from "../../api/errors.js"
import type { companyQuery } from "./validation.js"

type Query = ReturnType<typeof companyQuery>
const projection = `c.id, c.name, c.industry, c.type, c.specializations, c.location, c.slots, c.description,
  coalesce(i.url, '/getHiredLogo.png') as image, c.website, c.email, c.phone, c.hours, c.status`
const joined = `gethired_private.companies c left join gethired_private.company_images i on i.id = c.image_id`
async function get(client: SqlClient, id: string, admin = false): Promise<Company> {
  const result = await client.query(`select ${projection} from ${joined} where c.id=$1 ${admin ? "" : "and c.status='active'"}`, [id])
  if (!result.rows[0]) throw new ApiError("NOT_FOUND")
  return result.rows[0] as Company
}
export function createCompanyRepository(pool: SqlPool) {
  return {
    list(actor: Principal, query: Query, admin = false, bookmarks = false) {
      return authorizedTransaction(pool, actor, bookmarks ? "bookmarks:own" : admin ? "companies:write" : "companies:read", async client => {
        // One statement provides a consistent total and page, including empty pages.
        const values: unknown[] = []
        const bind = (v: unknown) => { values.push(v); return `$${values.length}` }
        const filters = [admin ? query.status ? `c.status=${bind(query.status)}` : "true" : "c.status='active'"]
        if (query.q) filters.push(`strpos(lower(concat_ws(' ',c.name,c.industry,c.location,array_to_string(c.specializations,' '))),lower(${bind(query.q)})) > 0`)
        const niche = COMPANY_NICHES[query.niche]
        if (niche.industry || niche.pattern) filters.push(`(c.industry=${bind(niche.industry ?? "")} or array_to_string(c.specializations,' ') ~* ${bind(niche.pattern ?? "a^")})`)
        if (query.specializations.length) filters.push(`c.specializations && ${bind(query.specializations)}::text[]`)
        if (bookmarks) filters.push(`b.account_id=${bind(actor.id)}`)
        const result = await client.query(`with matches as (
          select ${projection}${bookmarks ? ', b.created_at as "createdAt", c.id as "companyId"' : ""} from ${joined}
          ${bookmarks ? "join gethired_private.bookmarks b on b.company_id=c.id" : ""}
          where ${filters.join(" and ")}
        ), page as (select * from matches order by lower(name), id limit ${bind(query.pageSize)} offset ${bind((query.page - 1) * query.pageSize)})
        select (select count(*)::int from matches) as total, coalesce((select json_agg(page order by lower(name), id) from page),'[]'::json) as data`, values)
        const { total, data } = result.rows[0]
        return { data: bookmarks ? data.map((row: Company & { createdAt: string; companyId: string }) => {
          const { createdAt, companyId, ...company } = row
          return { companyId, createdAt, company } satisfies Bookmark
        }) : data as Company[], meta: { page: query.page, pageSize: query.pageSize, total } }
      })
    },
    get(actor: Principal, id: string) { return authorizedTransaction(pool, actor, "companies:read", client => get(client, id)) },
    save(actor: Principal, requestId: string, input: Partial<CompanyInput>, id?: string) {
      return authorizedTransaction(pool, actor, "companies:write", async client => {
        if (id) {
          const locked = await client.query("select id from gethired_private.companies where id=$1 for update", [id])
          if (!locked.rows.length) throw new ApiError("NOT_FOUND")
        }
        if (input.imageId) {
          const image = await client.query("select id from gethired_private.company_images where id=$1 and state='ready' for update", [input.imageId])
          if (!image.rows.length) throw new ApiError("VALIDATION_ERROR", { fieldErrors: { imageId: ["Upload a valid image first."] } })
        }
        const entries = Object.entries(input).map(([key, value]) => [key === "imageId" ? "image_id" : key, value] as const)
        const values = entries.map(([, value]) => value)
        const result = id ? await client.query(`update gethired_private.companies set ${entries.map(([key], n) => `${key}=$${n+1}`).join(",")}, updated_at=clock_timestamp() where id=$${values.length+1} returning id`, [...values, id])
          : await client.query(`insert into gethired_private.companies(${entries.map(([key]) => key).join(",")}) values (${values.map((_, n) => `$${n+1}`).join(",")}) returning id`, values)
        const resourceId = result.rows[0].id
        await appendAudit(client, { actorId: actor.id, requestId, action: id ? "company.updated" : "company.created", resourceType: "company", resourceId })
        return get(client, resourceId, true)
      })
    },
    bookmark(actor: Principal, id: string, remove = false) {
      return authorizedTransaction(pool, actor, "bookmarks:own", async client => {
        if (remove) {
          await client.query("delete from gethired_private.bookmarks where account_id=$1 and company_id=$2", [actor.id, id])
          return { removed: true }
        }
        // Serialize with deactivation. The owner always comes from the session.
        const active = await client.query("select id from gethired_private.companies where id=$1 and status='active' for share", [id])
        if (!active.rows.length) throw new ApiError("NOT_FOUND")
        await client.query("insert into gethired_private.bookmarks(account_id,company_id) values ($1,$2) on conflict do nothing", [actor.id, id])
        const saved = await client.query("select created_at from gethired_private.bookmarks where account_id=$1 and company_id=$2", [actor.id, id])
        return { companyId: id, createdAt: new Date(saved.rows[0].created_at).toISOString(), company: await get(client, id) }
      })
    },
  }
}
