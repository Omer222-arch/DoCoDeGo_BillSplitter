import { Hono } from 'hono'
import { requireText } from '../domain/validate'
import { HttpError, readJson } from '../lib/http'

export const homes = new Hono<{ Bindings: Env }>()

export async function requireHome(
  db: D1Database,
  homeId: string,
): Promise<{ id: string; name: string }> {
  const home = await db
    .prepare('SELECT id, name FROM homes WHERE id = ?1')
    .bind(homeId)
    .first<{ id: string; name: string }>()
  if (!home) throw new HttpError(404, 'Home not found')
  return home
}

homes.post('/', async (c) => {
  const name = requireText(await readJson(c.req), 'name', 100)
  const id = crypto.randomUUID()
  await c.env.DB.prepare('INSERT INTO homes (id, name) VALUES (?1, ?2)').bind(id, name).run()
  return c.json({ id, name }, 201)
})

homes.post('/:homeId/members', async (c) => {
  const homeId = c.req.param('homeId')
  await requireHome(c.env.DB, homeId)
  const name = requireText(await readJson(c.req), 'name', 100)
  const id = crypto.randomUUID()
  // One statement computes the next position and inserts, so SQLite does both atomically.
  await c.env.DB.prepare(
    `INSERT INTO members (id, home_id, name, position)
     SELECT ?1, ?2, ?3, COALESCE(MAX(position), 0) + 1 FROM members WHERE home_id = ?2`,
  )
    .bind(id, homeId, name)
    .run()
  return c.json({ id, homeId, name }, 201)
})

homes.get('/:homeId/balances', async (c) => {
  const homeId = c.req.param('homeId')
  await requireHome(c.env.DB, homeId)
  const { results } = await c.env.DB.prepare(
    `SELECT m.id AS memberId, m.name AS name, COALESCE(SUM(s.amount_cents), 0) AS outstandingCents
     FROM members m
     LEFT JOIN shares s ON s.member_id = m.id AND s.paid_at IS NULL
     WHERE m.home_id = ?1
     GROUP BY m.id
     ORDER BY m.position`,
  )
    .bind(homeId)
    .all<{ memberId: string; name: string; outstandingCents: number }>()
  return c.json({ balances: results })
})

homes.get('/:homeId', async (c) => {
  const homeId = c.req.param('homeId')
  const home = await requireHome(c.env.DB, homeId)
  const { results: members } = await c.env.DB.prepare(
    'SELECT id, home_id AS homeId, name FROM members WHERE home_id = ?1 ORDER BY position',
  )
    .bind(homeId)
    .all<{ id: string; homeId: string; name: string }>()
  return c.json({ ...home, members })
})
