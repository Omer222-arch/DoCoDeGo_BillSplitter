import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { request } from '../api/client'
import { decodeCreatedHome } from '../api/decode'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [homeId, setHomeId] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function createHome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreating(true)
    setError('')
    const result = await request('/api/homes', decodeCreatedHome, {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
    if (!result.ok) {
      setError(result.error)
      setCreating(false)
      return
    }
    await navigate({ to: '/homes/$homeId', params: { homeId: result.data.id } })
    setCreating(false)
  }

  function openHome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const id = homeId.trim()
    if (id) void navigate({ to: '/homes/$homeId', params: { homeId: id } })
  }

  return (
    <main className="shell">
      <header className="page-header">
        <p className="eyebrow">Shared home expenses</p>
        <h1>Split bills, simply.</h1>
        <p className="muted">
          Create a home, add your housemates, and keep everyone’s share clear.
        </p>
      </header>

      <div className="panel-grid">
        <section className="panel" aria-labelledby="create-home-heading">
          <h2 id="create-home-heading">Start a home</h2>
          <p className="muted">Give your shared space a name. You can add members next.</p>
          <form onSubmit={createHome} className="stack">
            <label>
              Home name
              <input
                autoComplete="organization"
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Flat 4B"
                required
                value={name}
              />
            </label>
            <button type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create home'}
            </button>
          </form>
          {error ? (
            <p role="alert" className="error">
              {error}
            </p>
          ) : null}
        </section>

        <section className="panel" aria-labelledby="open-home-heading">
          <h2 id="open-home-heading">Open a home</h2>
          <p className="muted">Already have a home ID? Enter it to view bills and balances.</p>
          <form onSubmit={openHome} className="stack">
            <label>
              Home ID
              <input
                autoComplete="off"
                onChange={(event) => setHomeId(event.target.value)}
                placeholder="Paste the home ID"
                required
                value={homeId}
              />
            </label>
            <button type="submit" className="button-secondary">
              Open home
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
