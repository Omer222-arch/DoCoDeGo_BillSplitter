import { describe, expect, it } from 'vitest'
import { type Bill, call, createBill, createHome, type Member } from './helpers'

describe('read endpoints used by the web page', () => {
  it('returns a home with its members in order', async () => {
    const { homeId, members } = await createHome(['A', 'B'])
    const res = await call<{ id: string; members: Member[] }>('GET', `/api/homes/${homeId}`)
    expect(res.status).toBe(200)
    expect(res.body.members.map((m) => m.id)).toEqual(members.map((m) => m.id))
  })

  it('lists bills with shares in member order, matching the create response', async () => {
    const { homeId } = await createHome(['A', 'B', 'C'])
    const created = await createBill(homeId, 1000)
    const res = await call<{ bills: Bill[] }>('GET', `/api/homes/${homeId}/bills`)
    expect(res.status).toBe(200)
    expect(res.body.bills).toEqual([created.body])
  })

  it('lists bills newest first, even when created in the same millisecond', async () => {
    const { homeId } = await createHome(['A'])
    const created = []
    for (let i = 0; i < 5; i++) created.push((await createBill(homeId, 100 + i)).body.id)
    const res = await call<{ bills: Bill[] }>('GET', `/api/homes/${homeId}/bills`)
    expect(res.body.bills.map((b) => b.id)).toEqual(created.reverse())
  })

  it('returns an empty list for a home without bills, and 404 for a missing home', async () => {
    const { homeId } = await createHome(['A'])
    expect((await call<{ bills: Bill[] }>('GET', `/api/homes/${homeId}/bills`)).body.bills).toEqual(
      [],
    )
    expect((await call('GET', '/api/homes/nope/bills')).status).toBe(404)
  })
})
