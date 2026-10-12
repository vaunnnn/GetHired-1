import type { SqlPool } from "../../auth/store.js"
import { transaction } from "../../db/transaction.js"

// Mark before external deletion; failed deletes retain a retryable tombstone.
export async function cleanCompanyImages(pool: SqlPool, storage: { remove(path: string): Promise<void> }, limit = 100) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid cleanup limit")
  const images = await transaction(pool, async client => {
    const candidates = await client.query(`select id, object_path from gethired_private.company_images
      where created_at < clock_timestamp() - interval '24 hours'
        and not exists(select 1 from gethired_private.companies c where c.image_id=company_images.id)
      order by created_at, id limit $1 for update skip locked`, [limit])
    const orphans: { id: string; object_path: string }[] = []
    for (const row of candidates.rows) {
      // Fresh snapshot after locking observes any completed attachment.
      const marked = await client.query(`update gethired_private.company_images i set state='deleting'
        where i.id=$1 and not exists(select 1 from gethired_private.companies c where c.image_id=i.id) returning i.id, i.object_path`, [row.id])
      if (marked.rows[0]) orphans.push(marked.rows[0] as { id: string; object_path: string })
    }
    return orphans
  })
  let cleaned = 0, failed = 0
  for (const image of images) {
    try {
      await storage.remove(image.object_path)
      await transaction(pool, client => client.query("delete from gethired_private.company_images where id=$1 and state='deleting'", [image.id]))
      cleaned++
    } catch { failed++ }
  }
  return { cleaned, failed }
}
