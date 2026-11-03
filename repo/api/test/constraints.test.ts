import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { createBill, createHome } from './helpers'

// These tests bypass the API on purpose: they prove the database itself refuses bad data.
describe('database constraints', () => {
  it('fk_bills_home: refuses a bill for a home that does not exist', async () => {
    await expect(
      env.DB.prepare(
        "INSERT INTO bills (id, home_id, title, total_cents) VALUES ('b', 'ghost', 't', 100)",
      ).run(),
    ).rejects.toThrow(/FOREIGN KEY/)
  })

  it('ck_bills_total_positive: refuses a zero total', async () => {
    const { homeId } = await createHome([])
    await expect(
      env.DB.prepare("INSERT INTO bills (id, home_id, title, total_cents) VALUES ('z', ?1, 't', 0)")
        .bind(homeId)
        .run(),
    ).rejects.toThrow(/CHECK/)
  })

  it('STRICT: refuses text in an integer column', async () => {
    const { homeId } = await createHome([])
    await expect(
      env.DB.prepare(
        "INSERT INTO bills (id, home_id, title, total_cents) VALUES ('s', ?1, 't', 'abc')",
      )
        .bind(homeId)
        .run(),
    ).rejects.toThrow()
  })

  it('ck_shares_paid_consistent: refuses paid_at without an idempotency key', async () => {
    const { homeId } = await createHome(['A'])
    const bill = await createBill(homeId, 100)
    const share = bill.body.shares[0]
    if (!share) throw new Error('no share')
    await expect(
      env.DB.prepare("UPDATE shares SET paid_at = '2026-01-01T00:00:00Z' WHERE id = ?1")
        .bind(share.id)
        .run(),
    ).rejects.toThrow(/CHECK/)
  })

  it('uq_shares_bill_member: refuses a second share for the same member on one bill', async () => {
    const { homeId, members } = await createHome(['A'])
    const bill = await createBill(homeId, 100)
    await expect(
      env.DB.prepare(
        "INSERT INTO shares (id, bill_id, member_id, amount_cents) VALUES ('dup', ?1, ?2, 1)",
      )
        .bind(bill.body.id, members[0]?.id ?? '')
        .run(),
    ).rejects.toThrow(/UNIQUE/)
  })
})
