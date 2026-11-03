/**
 * Splits totalCents into `count` integer parts that always add up to totalCents.
 * The first (totalCents % count) parts get one extra cent, so earlier members
 * absorb the remainder in the order they were added.
 */
export function splitCents(totalCents: number, count: number): number[] {
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
    throw new RangeError('totalCents must be a positive safe integer')
  }
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new RangeError('count must be a positive integer')
  }
  const base = Math.floor(totalCents / count)
  const remainder = totalCents % count
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0))
}
