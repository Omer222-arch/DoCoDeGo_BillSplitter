import { describe, expect, it } from 'vitest'
import { splitCents } from '../src/domain/split'
import { type Balance, call, createBill, createHome, type Share } from './helpers'

function pay(billId: string, shareId: string, key: string) {
  return call<Share>('POST', `/api/bills/${billId}/shares/${shareId}/pay`, {
    headers: { 'Idempotency-Key': key },
  })
}

describe('split invariant', () => {
  it('always sums to the total and differs by at most one cent', () => {
    for (let count = 1; count <= 40; count++) {
      for (const total of [1, 2, 7, 99, 100, 101, 999, 1000, 100001, 9_007_199_254_740_991]) {
        const parts = splitCents(total, count)
        expect(parts).toHaveLength(count)
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total)
        expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1)
        expect([...parts].sort((a, b) => b - a)).toEqual(parts)
      }
    }
  })

  it('allows zero-cent shares when the total is smaller than the member count', async () => {
    const { homeId } = await createHome(['A', 'B', 'C'])
    const bill = await createBill(homeId, 2)
    expect(bill.body.shares.map((s) => s.amountCents)).toEqual([1, 1, 0])
  })
})

describe('concurrency and idempotency', () => {
  it('lets exactly one of many parallel payments with different keys succeed', async () => {
    const { homeId } = await createHome(['A', 'B'])
    const bill = await createBill(homeId, 1000)
    const share = bill.body.shares[0]
    if (!share) throw new Error('no share')
    const results = await Promise.all(
      Array.from({ length: 10 }, () => pay(bill.body.id, share.id, crypto.randomUUID())),
    )
    const statuses = results.map((r) => r.status).sort()
    expect(statuses.filter((s) => s === 200)).toHaveLength(1)
    expect(statuses.filter((s) => s === 409)).toHaveLength(9)
  })

  it('answers parallel retries with the same key identically', async () => {
    const { homeId } = await createHome(['A', 'B'])
    const bill = await createBill(homeId, 1000)
    const share = bill.body.shares[0]
    if (!share) throw new Error('no share')
    const key = crypto.randomUUID()
    const results = await Promise.all(
      Array.from({ length: 5 }, () => pay(bill.body.id, share.id, key)),
    )
    expect(results.every((r) => r.status === 200)).toBe(true)
    expect(new Set(results.map((r) => r.body.paidAt)).size).toBe(1)
  })

  it('scopes a key to its share, so the same key on another share is a separate payment', async () => {
    const { homeId } = await createHome(['A', 'B'])
    const bill = await createBill(homeId, 1000)
    const [first, second] = bill.body.shares
    if (!first || !second) throw new Error('no shares')
    const key = crypto.randomUUID()
    expect((await pay(bill.body.id, first.id, key)).status).toBe(200)
    expect((await pay(bill.body.id, second.id, key)).status).toBe(200)
    const balances = await call<{ balances: Balance[] }>('GET', `/api/homes/${homeId}/balances`)
    expect(balances.body.balances.map((b) => b.outstandingCents)).toEqual([0, 0])
  })

  it('returns 404 for a real share addressed through the wrong bill', async () => {
    const { homeId } = await createHome(['A'])
    const billA = await createBill(homeId, 100)
    const billB = await createBill(homeId, 200)
    const shareOfB = billB.body.shares[0]
    if (!shareOfB) throw new Error('no share')
    expect((await pay(billA.body.id, shareOfB.id, crypto.randomUUID())).status).toBe(404)
  })
})

describe('input and error format', () => {
  it.each([undefined, '', '   ', 42])('rejects home name %j with JSON error', async (name) => {
    const res = await call<{ error: string }>('POST', '/api/homes', { body: { name } })
    expect(res.status).toBe(422)
    expect(res.body.error).toEqual(expect.any(String))
  })

  it.each([undefined, '', 12])('rejects bill title %j', async (title) => {
    const { homeId } = await createHome(['A'])
    const res = await call('POST', `/api/homes/${homeId}/bills`, {
      body: { title, totalCents: 100 },
    })
    expect(res.status).toBe(422)
  })

  it.each([Number.MAX_SAFE_INTEGER + 2, 0.1 + 0.2, '1e3', true, [100], { v: 1 }])(
    'rejects unusual amount %j',
    async (totalCents) => {
      const { homeId } = await createHome(['A'])
      const res = await call('POST', `/api/homes/${homeId}/bills`, {
        body: { title: 'x', totalCents },
      })
      expect(res.status).toBe(422)
    },
  )

  it('answers malformed JSON with 400 and a JSON error', async () => {
    const { exports } = await import('cloudflare:workers')
    const res = await exports.default.fetch(
      new Request('http://localhost/api/homes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"name": ',
      }),
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: expect.any(String) })
  })

  it('answers unknown routes with a JSON 404', async () => {
    const res = await call<{ error: string }>('GET', '/api/nope')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: expect.any(String) })
  })

  it('rejects a blank Idempotency-Key', async () => {
    const { homeId } = await createHome(['A'])
    const bill = await createBill(homeId, 100)
    const share = bill.body.shares[0]
    if (!share) throw new Error('no share')
    expect((await pay(bill.body.id, share.id, '   ')).status).toBe(400)
  })
})
