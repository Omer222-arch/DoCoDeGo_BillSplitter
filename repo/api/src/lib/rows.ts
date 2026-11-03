export type ShareRow = {
  id: string
  member_id: string
  amount_cents: number
  paid_at: string | null
  idempotency_key: string | null
}

export type ShareDto = { id: string; memberId: string; amountCents: number; paidAt: string | null }

export function toShareDto(row: ShareRow): ShareDto {
  return { id: row.id, memberId: row.member_id, amountCents: row.amount_cents, paidAt: row.paid_at }
}
