# SDE Intern Assignment: Shared Bill Splitter

Welcome. In this assignment you build a small bill splitter for a shared home. It has two parts:

1. **Homes and members:** create a home and add members to it.
2. **Bill splitting:** split a bill between the members. Each member pays their own share.

The assignment is small on purpose. We want correct, safe, and clear code. We do not want many features.

## What we look at

- **Your code passes the tests.** The tests decide, not opinion. You get the visible tests. We also run extra tests that you do not see.
- **Your code is safe when things go wrong.** Wrong input, repeated requests, and two requests at the same time must not break your data.
- **Your code is typed.** Use TypeScript. Do not use `any`.
- **You understand your code.** You record a short video and explain it.

Take your time. A careful, correct solution is better than a fast one. We expect 2 to 3 days of real work.

## Stack (required)

- **API:** Hono on Cloudflare Workers
- **Database:** Cloudflare D1 (SQLite). The binding is `DB` in `api/wrangler.jsonc`.
- **Web:** React, Vite, TanStack Router
- **Language:** TypeScript on both sides
- **Tests:** Vitest, running inside the Workers runtime
- **Quality:** Biome. `pnpm check` and `pnpm typecheck` must pass.

You choose the rest (styling, form library, validation library). Pick tools you can explain.

## The task

The assignment has two parts. Do Part 1 first. Part 2 builds on it.

**Database.** Write the schema as SQL migration files in `api/migrations/`. For example `0001_init.sql`. The tests apply every file in this folder. Your schema must have **at least 3 named constraints** that protect the data. For example a foreign key, a `CHECK`, or a `UNIQUE` key. Be ready to explain what each constraint stops.

**Errors.** Every error response is JSON: `{ "error": "message" }`.

## Part 1: Homes and members

Create a home and add members to it. The order in which members are added matters in Part 2.

#### `POST /api/homes`

- Request: `{ "name": string }`
- Success: `201` `{ id, name }`

#### `POST /api/homes/:homeId/members`

- Request: `{ "name": string }`
- Success: `201` `{ id, homeId, name }`
- Errors: `404` home not found

Visible tests: `api/test/homes.test.ts`.

## Part 2: Bill splitting

Add a bill to a home, split it between the members, and let each member pay their share.

All amounts are whole **cents** (integers). `100` cents is 1 dollar. Never use decimals for money.

#### `POST /api/homes/:homeId/bills`

- Request: `{ "title": string, "totalCents": number }`
- Success: `201` `{ id, homeId, title, totalCents, shares: [{ id, memberId, amountCents, paidAt: null }] }`
- Errors: `404` home not found. `422` total is not a positive whole number, or the home has no members.

#### `POST /api/bills/:billId/shares/:shareId/pay`

- Request: header `Idempotency-Key`
- Success: `200` `{ id, memberId, amountCents, paidAt }`
- Errors: `400` key missing. `404` bill or share not found. `409` share already paid with a different key.

#### `GET /api/homes/:homeId/balances`

- Success: `200` `{ balances: [{ memberId, name, outstandingCents }] }`
- Errors: `404` home not found

**Rules**

- **Split.** A bill is split between all members of the home. The shares always add up to `totalCents`. If the amount does not divide evenly, the extra cents go to the members one by one, in the order the members were added to the home. Example: 1000 cents between 3 members gives `334`, `333`, `333`.
- **Pay.** Paying marks one share as paid and sets `paidAt`. If the same `Idempotency-Key` is sent again for the same share, answer `200` with the same result. Do not pay twice. If two requests pay the same share at the same time, only one may succeed.
- **Balances.** `outstandingCents` is the sum of the member's unpaid shares, across all bills of the home. List the members in the order they were added.

Visible tests: `api/test/bills.test.ts` and `api/test/payments.test.ts`.

#### Web page

Build one page that:

- shows the bills of a home and the shares of each bill,
- lets a member pay a share,
- shows clear **loading**, **empty**, and **error** states,
- keeps the share unpaid and shows an error if the payment fails.

The page must not crash when the API answers with an error or is slow.

## Cases you must handle

You must handle these cases and talk about them in your video:

1. A home with no members.
2. An amount that is zero, negative, or not a whole number.
3. An amount that does not divide evenly.
4. The same payment request sent twice.
5. Two members paying the same share at the same time.
6. A bill or share that does not exist.
7. The API answers with a 500 error or is slow. The web page must not crash.

## Run it

This is a pnpm workspace. Install once at the root.

```bash
pnpm install
pnpm dev          # api on :8787 and web on :5173
```

Open http://localhost:5173 to create or open a home, add members, split bills, and record payments. `/api/health` returns `{ "status": "ok" }`.

If the web app reports a `502` while calling `/api/...`, check that the API terminal completed the D1 migration and reports Wrangler listening on `127.0.0.1:8787`. You can verify it directly at http://127.0.0.1:8787/api/health; restart `pnpm dev` if it does not return `{ "status": "ok" }`. If port 8787 is already in use, stop the existing API dev process before restarting; the dev script now fails clearly instead of letting Wrangler silently choose a different port.

```bash
pnpm test         # run API and web tests
pnpm check        # Biome: format and lint. Must pass.
pnpm check:fix    # fix what Biome can fix
pnpm typecheck    # tsc on both packages. Must pass.
pnpm build        # production build of the web app
```

`pnpm dev` applies your migrations to a local database before it starts the API.

If pnpm says some build scripts were ignored, run `pnpm approve-builds` and allow `esbuild` and `workerd`.

## Local verification flow

The API runs locally on Cloudflare's Workers runtime with a local D1 database. You do not need a deployed backend or external API credentials. Start both servers from the repository root and keep the terminal open; the API applies local migrations before it starts.

```bash
pnpm install
pnpm dev
```

### 1. Check that both servers are ready

- The API terminal should show that the D1 migration completed and Wrangler is listening on `127.0.0.1:8787`.
- Vite should show its local URL, normally `http://localhost:5173/`.
- Open `http://127.0.0.1:8787/api/health` directly. Expected response: `{"status":"ok"}`.
- Open the Vite URL and confirm the “Split bills, simply” home page appears.

The app does not currently include a Swagger/API explorer. Use the web page for the normal flow, or the PowerShell requests below to call the API directly. The browser app sends its `/api/...` requests through Vite's proxy to the local API.

### 2. Walk through the app in the browser

1. On the start page, create a home named `Day 2 walkthrough`. The app should open the new home. Copy its displayed **Home ID** if you want to open it again later.
2. Confirm the empty state asks you to add a member and does not offer bill creation yet.
3. Add `Asha`, then `Ben`, then `Chitra`, in that order. Confirm all three appear in Outstanding with `$0.00`.
4. Add a bill titled `Electricity` with **1000 cents**. Confirm its shares are `Asha $3.34`, `Ben $3.33`, and `Chitra $3.33`, and their outstanding balances match.
5. Pay Asha’s share. Confirm the button enters its loading state, then the server refresh changes the share to Paid and Asha’s outstanding balance to `$0.00`.
6. Refresh the browser page. Confirm the home, bill, paid share, and balances still match. Local D1 data persists between server restarts unless you explicitly remove the local Wrangler state.
7. From the start page, paste the copied Home ID into **Open a home** to confirm that opening an existing home works.

### 3. Smoke-test the API directly (Windows PowerShell)

Leave `pnpm dev` running in its terminal. In a second PowerShell terminal, run these requests from any directory. They create a separate test home in your local D1 database.

```powershell
$base = 'http://127.0.0.1:8787/api'
$createdHome = Invoke-RestMethod -Method Post -Uri "$base/homes" `
  -ContentType 'application/json' -Body (@{ name = 'PowerShell smoke test' } | ConvertTo-Json)

$members = foreach ($name in @('Asha', 'Ben', 'Chitra')) {
  Invoke-RestMethod -Method Post -Uri "$base/homes/$($createdHome.id)/members" `
    -ContentType 'application/json' -Body (@{ name = $name } | ConvertTo-Json)
}

$bill = Invoke-RestMethod -Method Post -Uri "$base/homes/$($createdHome.id)/bills" `
  -ContentType 'application/json' -Body (@{ title = 'Electricity'; totalCents = 1000 } | ConvertTo-Json)

$bill.shares | Select-Object memberId, amountCents, paidAt
($bill.shares.amountCents | Measure-Object -Sum).Sum
Invoke-RestMethod -Uri "$base/homes/$($createdHome.id)"
Invoke-RestMethod -Uri "$base/homes/$($createdHome.id)/bills"
Invoke-RestMethod -Uri "$base/homes/$($createdHome.id)/balances"
```

Expected: the share amounts are `334`, `333`, `333`; their sum is `1000`; `paidAt` starts as null; and the GET endpoints return the home with its ordered members, its bill with shares, and three balances of `334`, `333`, `333`.

To confirm payment retries are idempotent, send the same key twice for the same share:

```powershell
$share = $bill.shares[0]
$key = [guid]::NewGuid().ToString()
$payUri = "$base/bills/$($bill.id)/shares/$($share.id)/pay"
$firstPayment = Invoke-RestMethod -Method Post -Uri $payUri -Headers @{ 'Idempotency-Key' = $key }
$retryPayment = Invoke-RestMethod -Method Post -Uri $payUri -Headers @{ 'Idempotency-Key' = $key }
$firstPayment
$retryPayment
if ($firstPayment.paidAt -ne $retryPayment.paidAt) { throw 'Idempotent retry returned a different payment result.' }
```

Both responses should have the same share ID and `paidAt`. Use the refreshed balances endpoint to confirm only that share was removed from the outstanding amount.

### 4. Run the automated Day 1–2 checks

From the repository root, run:

```bash
pnpm check
pnpm typecheck
pnpm test
pnpm build
```

These are repeatable checks; you do not need to create test homes manually first. `api/test/edge-cases.test.ts` checks split totals and remainder distribution, zero-cent shares, parallel payments, idempotency, unusual inputs, and JSON errors. `api/test/constraints.test.ts` checks that the database rejects invalid rows. `api/test/read-endpoints.test.ts` checks the home, bill, and balance reads. `web/src/components/ShareRow.test.tsx` checks failed and pending payments, retrying with the same key, and server-confirmed paid status.

### 5. Verify an API outage without losing the web page

For this check, start the servers separately in two terminals instead of using the combined `pnpm dev` command:

```bash
# Terminal 1, repository root
pnpm --filter bill-splitter-api dev

# Terminal 2, repository root
pnpm --filter bill-splitter-web dev
```

Open a home that already has an unpaid share, stop only the API with Ctrl+C in Terminal 1, and try to pay that share. The page should remain usable, keep the share Unpaid, and show a network error rather than crashing or claiming the payment succeeded. Restart the API with the same command and retry; the app should refresh from server data. To verify the loading state, click Pay while the API is still running and observe the button change to “Paying…”.

When you change `api/wrangler.jsonc`, refresh the `Env` types:

```bash
pnpm --filter bill-splitter-api cf-typegen
```

## Rules for the tests

- The visible tests are in `api/test`. They start with a failing result. Your job is to make them pass.
- Do **not** change the visible tests or `api/test/helpers.ts`. We compare them with the original.
- We run extra tests after you submit. They test the cases in "Cases you must handle" more closely.

## AI policy

You can use AI tools. Tell us which ones and where in your answers on the form.
You must understand every line you submit. We check this with your video and in a live call. "The AI wrote it" is not an answer.

## How to submit

1. Click **Use this template**, then **Create a new repository**. Make the repository **public**.
2. Build your solution in your new repository. Small, clear commits are welcome.
3. Update this README with a short section called **Decisions**. Write 3 decisions you made and why.
4. Record a video of **3 minutes or less** (Loom or unlisted YouTube). Show the architecture, the data flow, and one trade-off you made. Make sure anyone with the link can view it.
5. Paste the repository link and the video link in the application form.

We will run `pnpm install && pnpm check && pnpm typecheck && pnpm test` on your repository.

## Decisions

1. **Represent money as integer cents.** This avoids floating-point rounding in validation, splitting, and balances.
2. **Assign remainder cents by member creation order.** Every split sums exactly to the bill total, and the result is predictable.
3. **Treat server data as the source of truth for payments.** A share stays unpaid in the UI until refreshed server data confirms it; retrying reuses the same idempotency key.

## Accessibility

- Both pages provide a keyboard-visible skip link to the main content.
- Bill shares use captions, column headers, and row headers so table relationships are announced by screen readers.
- Focus indicators remain visible, and reduced-motion preferences are respected.

## AI use

OpenAI Copilot SDK in VS Code was used to interpret the supplied blueprint, implement this Day 3 accessibility and documentation pass, and run the project checks. Review and understand all changes before submission.
