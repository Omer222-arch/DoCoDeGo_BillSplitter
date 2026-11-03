import { Hono } from 'hono'
import { splitCents } from '../domain/split'
import { requirePositiveCents, requireText } from '../domain/validate'
import { HttpError, readJson } from '../lib/http'
import type { ShareDto } from '../lib/rows'
import { requireHome } from './homes'

export const bills = new Hono<{ Bindings: Env }>()

type BillDto = { id: string; homeId: string; title: string; totalCents: number; shares: ShareDto[] }

bills.post('/:homeId/bills', async (c) => {
  const homeId = c.req.param('homeId')
  const db = c.env.DB
  await requireHome(db, homeId)
  const body = await readJson(c.req)
  const title = requireText(body, 'title', 200)
  const totalCents = requirePositiveCents(body, 'totalCents')

  const { results: members } = await db
    .prepare('SELECT id FROM members WHERE home_id = ?1 ORDER BY position')
    .bind(homeId)
    .all<{ id: string }>()
  if (members.length === 0)
    throw new HttpError(422, 'Home has no members to split the bill between')

  const amounts = splitCents(totalCents, members.length)
  const billId = crypto.randomUUID()
  const shares: ShareDto[] = members.map((member, index) => {
    const amountCents = amounts[index]
    // splitCents returns exactly one part per member; anything else is a bug, not a 0-cent share.
    if (amountCents === undefined) throw new Error('split returned fewer parts than members')
    return { id: crypto.randomUUID(), memberId: member.id, amountCents, paidAt: null }
  })

  // batch() runs as one transaction: the bill and all its shares are written, or nothing is.
  await db.batch([
    db
      .prepare('INSERT INTO bills (id, home_id, title, total_cents) VALUES (?1, ?2, ?3, ?4)')
      .bind(billId, homeId, title, totalCents),
    ...shares.map((share) =>
      db
        .prepare(
          'INSERT INTO shares (id, bill_id, member_id, amount_cents) VALUES (?1, ?2, ?3, ?4)',
        )
        .bind(share.id, billId, share.memberId, share.amountCents),
    ),
  ])

  const bill: BillDto = { id: billId, homeId, title, totalCents, shares }
  return c.json(bill, 201)
})

type BillShareRow = {
  billId: string
  title: string
  totalCents: number
  shareId: string
  memberId: string
  amountCents: number
  paidAt: string | null
}

bills.get('/:homeId/bills', async (c) => {
  const homeId = c.req.param('homeId')
  const db = c.env.DB
  await requireHome(db, homeId)
  // One statement, so bills and shares come from the same snapshot. Every bill has at
  // least one share (creation requires members). rowid follows insertion order, so
  // newest-first is exact even when two bills share a timestamp.
  const { results } = await db
    .prepare(
      `SELECT b.id AS billId, b.title, b.total_cents AS totalCents,
              s.id AS shareId, s.member_id AS memberId,
              s.amount_cents AS amountCents, s.paid_at AS paidAt
       FROM bills b
       JOIN shares s ON s.bill_id = b.id
       JOIN members m ON m.id = s.member_id
       WHERE b.home_id = ?1
       ORDER BY b.rowid DESC, m.position`,
    )
    .bind(homeId)
    .all<BillShareRow>()

  const byId = new Map<string, BillDto>()
  for (const row of results) {
    let bill = byId.get(row.billId)
    if (!bill) {
      bill = { id: row.billId, homeId, title: row.title, totalCents: row.totalCents, shares: [] }
      byId.set(row.billId, bill)
    }
    bill.shares.push({
      id: row.shareId,
      memberId: row.memberId,
      amountCents: row.amountCents,
      paidAt: row.paidAt,
    })
  }
  return c.json({ bills: [...byId.values()] })
})
