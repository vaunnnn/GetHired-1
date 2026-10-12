import type { SqlClient } from "../auth/store.js"
import { uuid } from "../api/validation.js"

// Deliberately identifiers only: never store answers, credentials, email contents,
// or arbitrary request bodies in audit/outbox records.
export async function appendAudit(client: SqlClient, event: {
  actorId: string; requestId: string; action: string; resourceType: string; resourceId: string;
}) {
  if (!/^[a-z][a-z0-9_.:-]{1,79}$/.test(event.action) || !/^[a-z][a-z0-9_]{1,39}$/.test(event.resourceType))
    throw new Error("Use a static audit action and resource type.")
  await client.query(`insert into gethired_private.audit_events(actor_id, request_id, action, resource_type, resource_id)
    values ($1, $2, $3, $4, $5)`, [uuid(event.actorId), uuid(event.requestId), event.action, event.resourceType, uuid(event.resourceId)])
}
export async function enqueue(client: SqlClient, job: { topic: string; resourceId: string; dedupeKey: string }) {
  if (!/^[a-z][a-z0-9_.:-]{1,79}$/.test(job.topic)) throw new Error("Use a static outbox topic.")
  await client.query(`insert into gethired_private.outbox(topic, resource_id, dedupe_key)
    values ($1, $2, $3) on conflict do nothing`, [job.topic, uuid(job.resourceId), uuid(job.dedupeKey)])
}

export interface OutboxJob { id: string; topic: string; resource_id: string; lease_token: string; attempts: number }
// Use a separate worker credential with gethired_outbox_worker membership.
export async function claimJobs(client: SqlClient, limit = 20): Promise<OutboxJob[]> {
  const result = await client.query<OutboxJob>("select * from gethired_private.claim_outbox($1)", [limit])
  return result.rows
}
export async function finishJob(client: SqlClient, job: OutboxJob, success: boolean): Promise<boolean> {
  const result = await client.query<{ finished: boolean }>("select gethired_private.finish_outbox($1, $2, $3) as finished", [job.id, job.lease_token, success])
  return result.rows[0]?.finished === true
}
