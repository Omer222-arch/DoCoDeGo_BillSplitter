import { Hono } from 'hono'
import { requireIdempotencyKey } from '../domain/validate'
import { HttpError } from '../lib/http'
import { type ShareRow, toShareDto } from '../lib/rows'

export const payments = new Hono<{ Bindings: Env }>()

const SHARE_COLUMNS = 'id, member_id, amount_cents, paid_at, idempotency_key'

payments.post('/:billId/shares/:shareId/pay', async (c) => {
  const key = requireIdempotencyKey(c.req.header('Idempotency-Key'))
  const { billId, shareId } = c.req.param()
  const db = c.env.DB

  // Check and write in one statement. SQLite applies writes one at a time, so only
  // the first request to reach this row still sees paid_at IS NULL and changes it.
  const claimed = await db
    .prepare(
      `UPDATE shares
       SET paid_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), idempotency_key = ?1
       WHERE id = ?2 AND bill_id = ?3 AND paid_at IS NULL
       RETURNING ${SHARE_COLUMNS}`,
    )
    .bind(key, shareId, billId)
    .first<ShareRow>()
  if (claimed) return c.json(toShareDto(claimed), 200)

  // Nothing changed: the share is missing, or it was already paid.
  const existing = await db
    .prepare(`SELECT ${SHARE_COLUMNS} FROM shares WHERE id = ?1 AND bill_id = ?2`)
    .bind(shareId, billId)
    .first<ShareRow>()
  if (!existing) {
    const bill = await db.prepare('SELECT id FROM bills WHERE id = ?1').bind(billId).first()
    throw new HttpError(404, bill ? 'Share not found on this bill' : 'Bill not found')
  }
  if (existing.idempotency_key === key) return c.json(toShareDto(existing), 200)
  throw new HttpError(409, 'Share is already paid')
})
