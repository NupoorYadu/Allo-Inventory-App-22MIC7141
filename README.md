# Allo Inventory Reservation System

Allo is a multi-warehouse inventory reservation platform built to show the hard parts of a real operational system: stock consistency, safe retries, release/expiry cleanup, and visible AI-assisted ops tooling.

The app is intentionally small enough to understand, but the critical workflows are implemented as real transactional paths rather than mocked UI flows.

## What the system does

- Displays inventory by product and warehouse
- Lets a customer reserve stock for a 10-minute payment window
- Confirms or releases reservations safely
- Reclaims expired reservations through a cron job
- Shows live operational analytics on the dashboard
- Exposes a deterministic AI assistant for inventory questions
- Exposes voice control for common dashboard actions
- Stress tests the reservation endpoint under concurrency

## Architecture

The app is organized around a few simple boundaries:

- `app/` for routes and UI
- `lib/` for data access and operational reasoning helpers
- `prisma/` for schema, migrations, and seed data
- `components/` for shared UI pieces, including the floating AI assistant
- `scripts/` for local validation helpers

I kept the codebase compact on purpose. The transactional logic lives close to the API routes because the main correctness problem is inventory mutation, not framework abstraction.

## Concurrency strategy

The reservation flow is the core of the product.

When `POST /api/reservations` runs, it does three important things:

1. Locks the idempotency key when one is provided.
2. Mutates `reservedStock` inside a database transaction.
3. Rejects the request with `409 Conflict` when stock would be oversold.

That means the application never relies on frontend state to decide stock availability. The database is the source of truth.

Idempotency is also handled server-side. If a client retries the same request with the same `Idempotency-Key`, the stored response is replayed instead of creating a duplicate reservation.

## Confirmation, release, and expiry

Reservations follow a simple lifecycle:

- `PENDING` when stock is reserved
- `CONFIRMED` when payment is completed
- `RELEASED` when inventory is returned to stock

Confirming a reservation decrements total stock and reserved stock in a transaction. Releasing a reservation puts the reserved units back. Expired reservations are reclaimed by the cron route.

The important point is that each state transition is backed by database writes, not optimistic UI updates.

## AI assistant

The AI experience is deliberately visible and operational rather than decorative.

Included features:

- Floating AI copilot on every major page
- AI insights card on the dashboard
- Deterministic natural-language inventory queries
- Voice command parsing for common operational actions
- AI summaries for inventory, reservations, and concurrency behavior
- AI explanation layer for the stress-test page

The assistant is powered by local reasoning helpers in `lib/ops-intelligence.ts`. I chose a deterministic layer instead of an external LLM for this project because the product needs to be reliable, cheap to run, and easy to validate during an interview.

## Voice commands

Voice input is implemented with the browser Web Speech API.

Supported examples:

- show low stock inventory
- open analytics
- run concurrency simulator
- show reservations

The UI shows transcript updates, a listening state, and a visible mic button so the voice feature is obvious, not hidden.

## Realtime updates

The dashboard uses lightweight polling so the UI stays fresh without extra infrastructure. That keeps the demo reliable and easy to deploy.

I chose polling over realtime subscriptions because the app is small, the operational data set is modest, and the assignment benefits more from predictable behavior than from a more complex push setup.

## Stress testing

The stress-test page sends real concurrent reservation requests to the backend.

The important verification points are:

- no overselling occurs
- failed requests return `409`
- repeated retries with the same idempotency key return the same reservation
- concurrency behavior is explained visually in the UI

I verified the deployed API with live burst tests:

- `10 x 1` requests succeeded without breaking the reservation flow
- `50 x 5` requests produced `409 Conflict` responses when stock was exhausted
- duplicate `Idempotency-Key` requests returned the same reservation response

## Cron cleanup

Expired pending reservations are released by a cron route:

- route: `/api/cron/release-expired`
- purpose: reclaim reservations that were never confirmed
- deployment: configured in `vercel.json`

On Vercel Hobby, cron cadence is limited, so this project uses the schedule supported by that plan. For higher-frequency cleanup, move the job to a plan or scheduler that supports it.

## Frontend experience

The dashboard is built to feel like an operational tool, not a demo page.

What I focused on:

- strong hierarchy in the AI sections
- consistent spacing and card sizing
- readable stock and reservation tables
- visible alerts and summary states
- responsive behavior for smaller screens
- a premium floating AI control that appears everywhere

The AI and voice features are intentionally placed where the reviewer will see them immediately.

## Validation

These checks passed in the current workspace:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- live API concurrency tests against the deployed environment
- idempotency retry verification against the deployed environment

## Local setup

```bash
npm install
npx prisma migrate deploy
npm run seed
npm run dev
```

Open:

```text
http://localhost:3000/dashboard
```

Useful commands:

```bash
npm run lint
npm run typecheck
npm run build
npm run test:concurrency
npm run demo:voice
```

## Deployment

The intended deployment shape is:

- Next.js app on Vercel
- PostgreSQL on Supabase
- Prisma migrations applied in production
- cron cleanup configured in Vercel

Before production use, verify:

- `DATABASE_URL` is correct
- cron access is configured
- production build succeeds in Vercel
- the deployed dashboard loads `/api/products` and `/api/reservations` successfully

## CI

A production-ready workflow should run:

- lint
- typecheck
- Prisma validate
- build

If you use GitHub Actions, keep the workflow small and predictable. The repo should validate the same way locally and in CI.

## Tradeoffs

- Polling is simpler than realtime subscriptions and is enough for this workload.
- Deterministic AI is less flashy than an LLM, but it is more reliable and easier to test.
- The stress-test page is intentionally operational and should be used carefully against demo data.
- The app favors correctness and clarity over abstraction-heavy architecture.

## Future improvements

- Add a durable reservation event log for auditing
- Add a small admin guard around the stress-test page
- Add browser automation for the dashboard flows
- Add true realtime subscriptions if the product grows beyond demo scale
- Add a structured alert feed for inventory anomalies
