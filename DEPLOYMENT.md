# Deployment Guide

This guide covers deploying the inventory reservation system to production.

## Prerequisites

- GitHub account with repository
- Vercel account (free tier is fine)
- PostgreSQL database (Supabase or Neon recommended)

## Step 1: Prepare Your Database

### Option A: Supabase (Recommended)

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in project details
4. Wait for project to initialize
5. Go to Settings → Database → Connection string
6. Copy the URI (looks like `postgresql://...`)
7. Save for next step

### Option B: Neon

1. Go to [neon.tech](https://neon.tech)
2. Create account and project
3. Copy connection string
4. Save for next step

### Option C: Local PostgreSQL

```bash
# macOS
brew install postgresql
brew services start postgresql

# Linux (Ubuntu)
sudo apt-get install postgresql
sudo systemctl start postgresql

# Create database
createdb inventory_db

# Connection string
postgresql://localhost/inventory_db
```

## Step 2: Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USER/inventory-app.git
git branch -M main
git push -u origin main
```

## Step 3: Deploy to Vercel

### Method 1: Web (Easiest)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import GitHub repo
3. Click "Continue"
4. Add environment variables:
   - **DATABASE_URL**: Your PostgreSQL connection string
   - **CRON_SECRET**: Generate random string (e.g., `openssl rand -hex 32`)
5. Click "Deploy"

### Method 2: CLI

```bash
npm i -g vercel
vercel
# Follow prompts, add DATABASE_URL when asked
```

## Step 4: Run Database Migrations

### Via Vercel CLI

```bash
vercel env pull
npx prisma migrate deploy
npm run seed
```

### Via Vercel Dashboard

1. Go to Vercel dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Verify DATABASE_URL is set
5. Go to Deployment

## Step 5: Verify Deployment

```bash
# Check that app loads
curl https://your-domain.vercel.app/

# Check API
curl https://your-domain.vercel.app/api/products

# Check cron (runs every minute)
curl https://your-domain.vercel.app/api/cron/release-expired
```

## Monitoring

### Vercel

- Dashboard shows deployments and errors
- Real-time logs available
- Analytics show usage patterns

### Database

Monitor PostgreSQL logs:

```sql
-- Check active reservations
SELECT status, COUNT(*) as count
FROM "Reservation"
GROUP BY status;

-- Check for stuck reservations
SELECT *
FROM "Reservation"
WHERE status = 'PENDING'
AND "expiresAt" < NOW()
LIMIT 10;

-- Check inventory health
SELECT p.name, w.name, i.totalStock, i.reservedStock,
       (i.totalStock - i.reservedStock) as available
FROM "Inventory" i
JOIN "Product" p ON i."productId" = p.id
JOIN "Warehouse" w ON i."warehouseId" = w.id
ORDER BY available ASC;
```

## Production Checklist

- [ ] DATABASE_URL set in Vercel
- [ ] CRON_SECRET set (if using)
- [ ] Migrations run successfully
- [ ] Seed data loaded
- [ ] All three pages load: `/`, `/admin`, `/stress-test`
- [ ] Can create reservation
- [ ] Can confirm/release reservation
- [ ] Admin dashboard shows real data
- [ ] Cron job runs (check logs every minute)
- [ ] Error handling works (test 409/410 responses)

## Scaling Tips

### If experiencing slow queries

1. Check database connections (check connection pool size)
2. Add Vercel Postgres read replicas
3. Cache product data with Redis

### If high reservation volume

1. Add database connection pooling via Neon
2. Monitor row lock wait times
3. Consider splitting inventory by warehouse region

### If cron falls behind

1. Schedule secondary worker endpoint
2. Increase cleanup frequency
3. Implement async queue (Bull, etc.)

## Troubleshooting

### "DATABASE_URL is missing"

Add to Vercel environment variables:
```bash
vercel env add DATABASE_URL
# Paste your connection string
```

### "Prisma migrations pending"

Run migrations:
```bash
npx prisma migrate deploy
```

### "No seed data"

```bash
npm run seed
```

Or seed manually:
```bash
npx prisma db seed
```

### "Cron job not running"

1. Check `vercel.json` is in root
2. Check Vercel logs (Deployments → Cron → Logs)
3. Verify endpoint returns 200 status

### High latency on reservations

1. Check database connection latency
2. Run `SELECT * FROM "Inventory" LIMIT 1` – should be <50ms
3. If >100ms, consider regional deployment

## Environment Variables Reference

```bash
# Required
DATABASE_URL="postgresql://..."

# Optional
CRON_SECRET="any-random-string"
NEXT_PUBLIC_SUPABASE_URL="..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."

# Development only
NODE_ENV="development"
```

## Rollback Procedure

```bash
# If something breaks in production
git revert <commit-hash>
git push origin main

# Vercel auto-deploys on push
# If database is corrupted, restore from backup:
# Contact database provider (Supabase/Neon)
```

## Performance Baseline

Expected response times:

- GET /api/products: ~100-200ms
- POST /api/reservations: ~50-100ms (row lock overhead)
- GET /api/reservations: ~200-300ms
- POST /api/reservations/:id/confirm: ~30-50ms
- Admin dashboard (all requests): ~500ms

If significantly slower, check:
1. Database connection latency
2. Network between Vercel and database provider
3. Database query slow logs

## Cost Estimation

### Monthly costs

- Vercel: Free (up to ~$20/month for high usage)
- Supabase: Free (up to 100k requests/month)
- Combined: ~$10-50/month at small scale

### Scaling costs

- 10k/month usage: Mostly free
- 100k/month usage: ~$20-30 Supabase, $10 Vercel
- 1M/month usage: ~$100+ Supabase, $50 Vercel

---

**Questions?** Check the main README.md for architecture details.
