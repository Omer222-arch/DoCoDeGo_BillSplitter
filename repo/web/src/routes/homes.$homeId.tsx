import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { type ApiResult, request } from '../api/client'
import { decodeBalances, decodeBill, decodeBills, decodeHome, decodeMember } from '../api/decode'
import type { Bill } from '../api/types'
import { ShareRow } from '../components/ShareRow'
import { formatCents } from '../lib/money'

function must<T>(result: ApiResult<T>): T {
  if (!result.ok) throw new Error(result.error)
  return result.data
}

export const Route = createFileRoute('/homes/$homeId')({
  loader: async ({ params }) => {
    const base = `/api/homes/${params.homeId}`
    const [home, bills, balances] = await Promise.all([
      request(base, decodeHome),
      request(`${base}/bills`, decodeBills),
      request(`${base}/balances`, decodeBalances),
    ])
    return { home: must(home), bills: must(bills), balances: must(balances) }
  },
  pendingMs: 200,
  pendingComponent: () => <p role="status">Loading bills…</p>,
  errorComponent: ({ error }) => (
    <LoadFailed message={error instanceof Error ? error.message : 'Unexpected error'} />
  ),
  component: HomePage,
})

function LoadFailed({ message }: { message: string }) {
  const router = useRouter()
  return (
    <div role="alert">
      <p>Could not load this home: {message}</p>
      <button type="button" onClick={() => router.invalidate()}>
        Try again
      </button>
    </div>
  )
}

function HomePage() {
  const { home, bills, balances } = Route.useLoaderData()
  const router = useRouter()
  const [memberName, setMemberName] = useState('')
  const [memberError, setMemberError] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [billTitle, setBillTitle] = useState('')
  const [totalCents, setTotalCents] = useState('')
  const [billError, setBillError] = useState('')
  const [addingBill, setAddingBill] = useState(false)
  const names = new Map(home.members.map((m) => [m.id, m.name]))

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAddingMember(true)
    setMemberError('')
    try {
      const result = await request(`/api/homes/${home.id}/members`, decodeMember, {
        method: 'POST',
        body: JSON.stringify({ name: memberName }),
      })
      if (!result.ok) {
        setMemberError(result.error)
        return
      }
      setMemberName('')
      await router.invalidate()
    } finally {
      setAddingMember(false)
    }
  }

  async function addBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cents = Number(totalCents)
    if (!Number.isSafeInteger(cents) || cents <= 0) {
      setBillError('Enter a positive whole number of cents.')
      return
    }
    setAddingBill(true)
    setBillError('')
    try {
      const result = await request(`/api/homes/${home.id}/bills`, decodeBill, {
        method: 'POST',
        body: JSON.stringify({ title: billTitle, totalCents: cents }),
      })
      if (!result.ok) {
        setBillError(result.error)
        return
      }
      setBillTitle('')
      setTotalCents('')
      await router.invalidate()
    } finally {
      setAddingBill(false)
    }
  }

  return (
    <main className="shell">
      <a className="skip-link" href="#balances">
        Skip to main content
      </a>
      <header className="page-header home-heading">
        <Link to="/" className="back-link">
          ← All homes
        </Link>
        <p className="eyebrow">Shared home</p>
        <h1>{home.name}</h1>
        <p className="muted">
          Home ID: <code>{home.id}</code>
        </p>
      </header>

      <div className="panel-grid">
        <section className="panel" aria-labelledby="balances">
          <h2 id="balances" tabIndex={-1}>
            Outstanding balances
          </h2>
          {balances.length === 0 ? (
            <p className="muted">Add your first member to get started.</p>
          ) : (
            <ul className="balance-list">
              {balances.map((b) => (
                <li key={b.memberId}>
                  <span>{b.name}</span>
                  <strong>{formatCents(b.outstandingCents)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-labelledby="members-heading">
          <h2 id="members-heading">Add a housemate</h2>
          <form onSubmit={addMember} className="stack">
            <label>
              Member name
              <input
                autoComplete="name"
                maxLength={100}
                onChange={(event) => setMemberName(event.target.value)}
                placeholder="e.g. Asha"
                required
                value={memberName}
              />
            </label>
            <button type="submit" disabled={addingMember}>
              {addingMember ? 'Adding…' : 'Add member'}
            </button>
          </form>
          {memberError ? (
            <p role="alert" className="error">
              {memberError}
            </p>
          ) : null}
        </section>
      </div>

      {home.members.length > 0 ? (
        <section className="panel bill-form-panel" aria-labelledby="new-bill-heading">
          <h2 id="new-bill-heading">Add a bill</h2>
          <p className="muted">
            The amount is split across all current members, with extra cents going to earlier
            members.
          </p>
          <form onSubmit={addBill} className="bill-form">
            <label>
              Bill title
              <input
                maxLength={200}
                onChange={(event) => setBillTitle(event.target.value)}
                placeholder="e.g. Electricity"
                required
                value={billTitle}
              />
            </label>
            <label>
              Total (cents)
              <input
                inputMode="numeric"
                min="1"
                onChange={(event) => setTotalCents(event.target.value)}
                placeholder="e.g. 10000"
                required
                step="1"
                type="number"
                value={totalCents}
              />
            </label>
            <button type="submit" disabled={addingBill}>
              {addingBill ? 'Splitting…' : 'Split bill'}
            </button>
          </form>
          {billError ? (
            <p role="alert" className="error">
              {billError}
            </p>
          ) : null}
        </section>
      ) : (
        <p className="notice">Add at least one member before creating a bill.</p>
      )}

      <section className="bills-section" aria-labelledby="bills">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Activity</p>
            <h2 id="bills">Bills</h2>
          </div>
          <span className="count-badge">{bills.length}</span>
        </div>
        {bills.length === 0 ? (
          <div className="empty-state">
            <h3>No bills yet</h3>
            <p className="muted">Add a bill above to see everyone’s share here.</p>
          </div>
        ) : (
          bills.map((bill) => <BillCard key={bill.id} bill={bill} names={names} />)
        )}
      </section>
    </main>
  )
}

function BillCard({ bill, names }: { bill: Bill; names: Map<string, string> }) {
  const router = useRouter()
  return (
    <article>
      <h3>
        {bill.title} · {formatCents(bill.totalCents)}
      </h3>
      <table>
        <caption className="visually-hidden">{bill.title} shares</caption>
        <thead>
          <tr>
            <th scope="col">Member</th>
            <th scope="col">Share</th>
            <th scope="col">Payment status</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {bill.shares.map((share) => (
            <ShareRow
              key={share.id}
              billId={bill.id}
              share={share}
              name={names.get(share.memberId) ?? 'Unknown'}
              onSettled={() => router.invalidate()}
            />
          ))}
        </tbody>
      </table>
    </article>
  )
}
