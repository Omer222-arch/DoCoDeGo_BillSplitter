const PREFIX = 'pay-key:'

/** Returns the key for this share's current attempt, creating one if needed. */
export function keyForShare(shareId: string): string {
  try {
    const existing = sessionStorage.getItem(PREFIX + shareId)
    if (existing) return existing
    const created = crypto.randomUUID()
    sessionStorage.setItem(PREFIX + shareId, created)
    return created
  } catch {
    return crypto.randomUUID()
  }
}

/** Forget the key once the server has given a final answer (200 or 409). */
export function clearKeyForShare(shareId: string): void {
  try {
    sessionStorage.removeItem(PREFIX + shareId)
  } catch {
    // storage unavailable: nothing to clear
  }
}
