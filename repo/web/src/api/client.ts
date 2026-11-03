import type { Decoder } from './decode'

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }

const TIMEOUT_MS = 10_000

function errorMessage(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    if (typeof body.error === 'string') return body.error
  }
  return fallback
}

/** Never throws: every failure (network, timeout, HTTP error, bad shape) becomes a value. */
export async function request<T>(
  path: string,
  decode: Decoder<T>,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...init.headers },
      signal: init.signal ?? AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
    return {
      ok: false,
      status: 0,
      error: timedOut ? 'The server took too long to answer.' : 'Could not reach the server.',
    }
  }
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const fallback = `Request failed (${response.status})`
    return { ok: false, status: response.status, error: errorMessage(body, fallback) }
  }
  const data = decode(body)
  if (data === null) {
    return { ok: false, status: response.status, error: 'Unexpected response from the server.' }
  }
  return { ok: true, data }
}
