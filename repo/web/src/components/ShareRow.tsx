import { useState } from 'react'
import { request } from '../api/client'
import { decodeShare } from '../api/decode'
import type { Share } from '../api/types'
import { clearKeyForShare, keyForShare } from '../lib/idempotency'
import { formatCents } from '../lib/money'

type PayState = { kind: 'idle' } | { kind: 'paying' } | { kind: 'failed'; message: string }

type Props = {
  billId: string
  share: Share
  name: string
  /** Re-fetch server data. The row never decides on its own that a share is paid. */
  onSettled: () => Promise<void>
}

export function ShareRow({ billId, share, name, onSettled }: Props) {
  const [state, setState] = useState<PayState>({ kind: 'idle' })
  const paid = share.paidAt !== null // single source of truth: the server data in props

  async function pay() {
    setState({ kind: 'paying' })
    const result = await request(`/api/bills/${billId}/shares/${share.id}/pay`, decodeShare, {
      method: 'POST',
      headers: { 'Idempotency-Key': keyForShare(share.id) },
    })
    if (result.ok) {
      clearKeyForShare(share.id)
      await onSettled()
      setState({ kind: 'idle' })
      return
    }
    if (result.status === 409) {
      // Final answer from the server: someone else paid. Forget this attempt and refresh.
      clearKeyForShare(share.id)
      await onSettled()
    }
    // Any other failure keeps the key, so Retry replays the same intent safely.
    setState({ kind: 'failed', message: result.error })
  }

  return (
    <tr>
      <td>{name}</td>
      <td>{formatCents(share.amountCents)}</td>
      <td>{paid ? 'Paid' : 'Unpaid'}</td>
      <td>
        {paid ? null : (
          <button type="button" onClick={pay} disabled={state.kind === 'paying'}>
            {state.kind === 'paying' ? 'Paying…' : state.kind === 'failed' ? 'Retry' : 'Pay'}
          </button>
        )}
        {state.kind === 'failed' && !paid ? <span role="alert">{state.message}</span> : null}
      </td>
    </tr>
  )
}
