import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Share } from '../api/types'
import { ShareRow } from './ShareRow'

const unpaid: Share = { id: 'share-1', memberId: 'm-1', amountCents: 334, paidAt: null }

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function renderRow(share: Share, onSettled = vi.fn(async () => {})) {
  const view = render(
    <table>
      <tbody>
        <ShareRow billId="bill-1" share={share} name="Asha" onSettled={onSettled} />
      </tbody>
    </table>,
  )
  return { ...view, onSettled }
}

function sentKey(fetchMock: ReturnType<typeof vi.fn>, call: number): string | undefined {
  const init: unknown = fetchMock.mock.calls[call]?.[1]
  if (typeof init !== 'object' || init === null || !('headers' in init)) return undefined
  const headers = init.headers
  if (typeof headers !== 'object' || headers === null || !('Idempotency-Key' in headers)) {
    return undefined
  }
  return typeof headers['Idempotency-Key'] === 'string' ? headers['Idempotency-Key'] : undefined
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  sessionStorage.clear()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function clickPay() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button'))
  })
}

describe('ShareRow payment states', () => {
  it('keeps the share unpaid and shows the error when the server answers 500', async () => {
    fetchMock.mockResolvedValue(json(500, { error: 'Internal server error' }))
    const { onSettled } = renderRow(unpaid)

    await clickPay()

    expect(screen.getByText('Unpaid')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe('Internal server error')
    expect(screen.getByRole('button').textContent).toBe('Retry')
    expect(onSettled).not.toHaveBeenCalled()
  })

  it('keeps the share unpaid when the network fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    renderRow(unpaid)

    await clickPay()

    expect(screen.getByText('Unpaid')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe('Could not reach the server.')
  })

  it('disables the button while the payment is pending', async () => {
    fetchMock.mockReturnValue(new Promise<Response>(() => {}))
    renderRow(unpaid)

    await clickPay()

    const button = screen.getByRole('button')
    expect(button.textContent).toBe('Paying…')
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('Unpaid')).toBeTruthy()
  })

  it('retries a failed payment with the same Idempotency-Key', async () => {
    fetchMock
      .mockResolvedValueOnce(json(500, { error: 'boom' }))
      .mockResolvedValueOnce(json(200, { ...unpaid, paidAt: '2026-11-02T10:00:00.000Z' }))
    const { onSettled } = renderRow(unpaid)

    await clickPay()
    await clickPay()

    expect(sentKey(fetchMock, 0)).toEqual(expect.any(String))
    expect(sentKey(fetchMock, 1)).toBe(sentKey(fetchMock, 0))
    expect(onSettled).toHaveBeenCalledTimes(1)
  })

  it('shows Paid only once the server data passed in says so', async () => {
    fetchMock.mockResolvedValue(json(200, { ...unpaid, paidAt: '2026-11-02T10:00:00.000Z' }))
    const { onSettled, rerender } = renderRow(unpaid)

    await clickPay()
    expect(onSettled).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Unpaid')).toBeTruthy()

    rerender(
      <table>
        <tbody>
          <ShareRow
            billId="bill-1"
            share={{ ...unpaid, paidAt: '2026-11-02T10:00:00.000Z' }}
            name="Asha"
            onSettled={onSettled}
          />
        </tbody>
      </table>,
    )
    expect(screen.getByText('Paid')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('refreshes and stays unpaid on screen after a 409', async () => {
    fetchMock.mockResolvedValue(json(409, { error: 'Share is already paid' }))
    const { onSettled } = renderRow(unpaid)

    await clickPay()

    expect(onSettled).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert').textContent).toBe('Share is already paid')
  })
})
