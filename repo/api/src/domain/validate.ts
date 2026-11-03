import { HttpError } from '../lib/http'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function requireText(body: unknown, field: string, maxLength: number): string {
  const value = isRecord(body) ? body[field] : undefined
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpError(422, `${field} must be a non-empty string`)
  }
  const trimmed = value.trim()
  if (trimmed.length > maxLength) {
    throw new HttpError(422, `${field} must be at most ${maxLength} characters`)
  }
  return trimmed
}

export function requirePositiveCents(body: unknown, field: string): number {
  const value = isRecord(body) ? body[field] : undefined
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new HttpError(422, `${field} must be a positive whole number of cents`)
  }
  return value
}

export function requireIdempotencyKey(header: string | undefined): string {
  const key = header?.trim()
  if (!key) throw new HttpError(400, 'Idempotency-Key header is required')
  if (key.length > 255) throw new HttpError(400, 'Idempotency-Key must be at most 255 characters')
  return key
}
