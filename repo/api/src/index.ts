import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { HttpError } from './lib/http'
import { bills } from './routes/bills'
import { homes } from './routes/homes'
import { payments } from './routes/payments'

const app = new Hono<{ Bindings: Env }>()

app.get('/api/health', (c) => c.json({ status: 'ok' }))
app.route('/api/homes', homes)
app.route('/api/homes', bills)
app.route('/api/bills', payments)

app.notFound((c) => c.json({ error: 'Route not found' }, 404))

app.onError((error, c) => {
  if (error instanceof HttpError) return c.json({ error: error.message }, error.status)
  if (error instanceof HTTPException) return c.json({ error: error.message }, error.status)
  console.error(error)
  return c.json({ error: 'Internal server error' }, 500)
})

export default app
