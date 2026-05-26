# Allo Inventory Reservation System

A small multi-warehouse inventory reservation app built with Next.js App Router, Prisma, PostgreSQL, Tailwind CSS, Zod, and Recharts.

The main engineering problem is preventing overselling while a customer is away completing payment. A reservation holds stock for 10 minutes. Confirming the reservation permanently consumes stock; releasing or expiring it makes the stock available again.

## What Is Implemented

- Product listing with per-warehouse inventory
- Reservation checkout page with countdown timers
- Confirm and release actions
- Atomic reservation writes in PostgreSQL transactions
- Idempotency keys for safe retries
- Lightweight polling for inventory updates
- Vercel cron endpoint for expired reservations
- Real concurrent stress test UI
- Minimal analytics dashboard with warehouse utilization
- GitHub Actions CI for typecheck, build, and Prisma validation

## Stack

- Next.js App Router
- TypeScript
- Prisma
- PostgreSQL, tested with Supabase
- Tailwind CSS
- Zod
- date-fns
- Recharts

I kept the architecture deliberately simple: `app/` for routes and UI, `lib/` for small shared helpers, and `prisma/` for schema/seed data. There are no repositories, services, queues, or extra layers because the transactional boundary is small enough to understand directly in the route handlers.

## Data Model

```prisma
Product {
  id
  name
  createdAt
}

Warehouse {
  id
  name
  createdAt
}

Inventory {
  id
  productId
  warehouseId
  totalStock
  reservedStock
  @@unique([productId, warehouseId])
}

Reservation {
  id
  inventoryId
  quantity
  status: PENDING | CONFIRMED | RELEASED
  expiresAt
  createdAt
}

IdempotencyKey {
  key
  result
  createdAt
}
```

Available stock is always computed as:

```ts
availableStock = totalStock - reservedStock
```

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/products` | Products with warehouse inventory and available stock |
| `GET` | `/api/warehouses` | Warehouse list |
| `GET` | `/api/reservations` | Recent reservations |
| `POST` | `/api/reservations` | Create a 10-minute reservation |
| `POST` | `/api/reservations/:id/confirm` | Confirm payment and consume stock |
| `POST` | `/api/reservations/:id/release` | Release a pending reservation |
| `GET` | `/api/cron/release-expired` | Release expired pending reservations |

## Concurrency Design

The important route is `POST /api/reservations`.

Inside a Prisma transaction it:

1. optionally locks the idempotency key with `pg_advisory_xact_lock`
2. checks whether the idempotency response already exists
3. atomically increments `reservedStock` with a conditional `UPDATE ... RETURNING`
4. checks `totalStock - reservedStock`
5. creates the reservation
6. stores the idempotency response

I chose PostgreSQL transactional writes instead of Redis locks because the inventory state already lives in Postgres. Keeping the reservation decision, stock mutation, and idempotency write inside one transaction makes the correctness story much easier to defend.

I verified the core concurrency case against the real API:

```txt
two concurrent requests for stock=1
result: one 201 Created, one 409 Conflict
reservations created: 1
```

## Confirmation Flow

Confirming a reservation also happens in a transaction:

1. lock the reservation row
2. verify it exists
3. verify it is still `PENDING`
4. verify it has not expired
5. lock the inventory row
6. decrement `totalStock`
7. decrement `reservedStock`
8. mark the reservation `CONFIRMED`

If the reservation expired before confirmation, the API returns `410`.

## Release And Expiry

Manual release locks the reservation and inventory rows, decrements `reservedStock`, and marks the reservation `RELEASED`.

Expired reservations are handled by `/api/cron/release-expired`. The cron route locks expired pending reservations, locks their inventory rows, decrements reserved stock, and marks them released.

`vercel.json` is configured for a daily cron on Vercel Hobby:

```json
{
  "crons": [
    {
      "path": "/api/cron/release-expired",
      "schedule": "0 0 * * *"
    }
  ]
}
```

Vercel Hobby accounts only allow daily cron jobs. For a true every-minute production cron, deploy this on a plan that supports that cadence, or run the cleanup from an external scheduler.

If `CRON_SECRET` is set, the cron endpoint expects:

```txt
Authorization: Bearer <CRON_SECRET>
```

## Idempotency

Clients can send:

```txt
Idempotency-Key: <uuid>
```

The API stores the original response and replays it on retry. This applies to both successful reservations and insufficient-stock `409` responses. A PostgreSQL advisory transaction lock prevents two concurrent retries with the same key from creating duplicate reservations.

## Frontend

The dashboard at `/dashboard` includes:

- Products tab with warehouse stock and reserve actions
- Reservation checkout tab with countdowns, confirm/release buttons, badges, and activity timeline
- Analytics tab with inventory metrics and warehouse utilization
- Stress Test tab that sends real concurrent `POST /api/reservations` requests

Stock refreshes every 5 seconds with lightweight polling. I chose polling over Supabase Realtime because it keeps the demo stateless and simple, and a few seconds of delay is acceptable for this assignment-sized admin view.

## Local Setup

```bash
npm install
cp .env.example .env
npx prisma migrate deploy
npm run seed
npm run dev
```

Open:

```txt
http://localhost:3000
```

Useful commands:

```bash
npm run lint
npm run build
npx prisma validate
```

On Windows, stop the dev server before running a fresh production build if Prisma reports that its query engine DLL is locked.

## Environment Variables

```env
DATABASE_URL="postgresql://..."
CRON_SECRET="optional-shared-secret"
```

The frontend uses same-origin API calls by default. Do not set `NEXT_PUBLIC_API_URL` unless the frontend and API are intentionally hosted on different origins.

## Deployment

The app is intended for Vercel + Supabase:

1. Create a Supabase Postgres database.
2. Add `DATABASE_URL` and `CRON_SECRET` in Vercel project settings.
3. Deploy with Vercel.
4. Run migrations against production:

```bash
npx prisma migrate deploy
```

5. Seed only for local development or one-time demo data:

```bash
npm run seed
```

The build script runs `prisma generate && next build` because Vercel caches dependencies and Prisma Client must be regenerated during the build.

## CI

GitHub Actions runs on `main`, `master`, and `develop`:

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npx prisma validate`
- route presence checks for the main APIs

## Tradeoffs

- Reservation status is stored as a string instead of a Prisma enum. An enum would be slightly stricter, but the current model is compact and easy to migrate.
- Activity timeline is derived from reservation state and timestamps rather than a separate event table. For a real audit trail, I would add a `ReservationEvent` table.
- Polling is used instead of Supabase Realtime to avoid extra moving parts.
- The stress test intentionally creates real reservations. It is an internal tool and should be used on demo stock or reset afterward.

## Future Improvements

- Add a `ReservationEvent` table for a durable lifecycle audit trail.
- Move expiry cleanup to a dedicated worker if traffic grows.
- Add automated integration tests for the concurrent reservation path.
- Add a small admin-only guard around the stress test page before using it outside a demo environment.
