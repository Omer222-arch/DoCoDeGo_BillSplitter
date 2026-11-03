import type { Balance, Bill, Home, Member, Share } from './types'

/** Turns an unknown JSON value into T, or null if it does not match the contract. */
export type Decoder<T> = (value: unknown) => T | null

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function list<T>(value: unknown, decode: Decoder<T>): T[] | null {
  if (!Array.isArray(value)) return null
  const out: T[] = []
  for (const item of value) {
    const decoded = decode(item)
    if (decoded === null) return null
    out.push(decoded)
  }
  return out
}

export const decodeShare: Decoder<Share> = (v) =>
  isRecord(v) &&
  typeof v.id === 'string' &&
  typeof v.memberId === 'string' &&
  typeof v.amountCents === 'number' &&
  (v.paidAt === null || typeof v.paidAt === 'string')
    ? { id: v.id, memberId: v.memberId, amountCents: v.amountCents, paidAt: v.paidAt }
    : null

export const decodeCreatedHome: Decoder<Pick<Home, 'id' | 'name'>> = (v) =>
  isRecord(v) && typeof v.id === 'string' && typeof v.name === 'string'
    ? { id: v.id, name: v.name }
    : null

export const decodeMember: Decoder<Member> = (v) =>
  isRecord(v) &&
  typeof v.id === 'string' &&
  typeof v.homeId === 'string' &&
  typeof v.name === 'string'
    ? { id: v.id, homeId: v.homeId, name: v.name }
    : null

export const decodeBill: Decoder<Bill> = (v) => {
  if (!isRecord(v)) return null
  const shares = list(v.shares, decodeShare)
  return typeof v.id === 'string' &&
    typeof v.homeId === 'string' &&
    typeof v.title === 'string' &&
    typeof v.totalCents === 'number' &&
    shares
    ? { id: v.id, homeId: v.homeId, title: v.title, totalCents: v.totalCents, shares }
    : null
}

const decodeBalance: Decoder<Balance> = (v) =>
  isRecord(v) &&
  typeof v.memberId === 'string' &&
  typeof v.name === 'string' &&
  typeof v.outstandingCents === 'number'
    ? { memberId: v.memberId, name: v.name, outstandingCents: v.outstandingCents }
    : null

export const decodeHome: Decoder<Home> = (v) => {
  if (!isRecord(v)) return null
  const members = list(v.members, decodeMember)
  return typeof v.id === 'string' && typeof v.name === 'string' && members
    ? { id: v.id, name: v.name, members }
    : null
}

export const decodeBills: Decoder<Bill[]> = (v) => (isRecord(v) ? list(v.bills, decodeBill) : null)

export const decodeBalances: Decoder<Balance[]> = (v) =>
  isRecord(v) ? list(v.balances, decodeBalance) : null
