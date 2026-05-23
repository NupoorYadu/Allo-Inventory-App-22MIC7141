# Concurrency & Row Locking Deep Dive

This document explains how the inventory system ensures concurrent requests don't oversell. It's critical to understand why this architecture works.

## The Problem: Race Conditions

Without concurrency control, two concurrent requests can cause overselling:

```
Inventory before: totalStock=1, reservedStock=0
User A Request (T=0ms): Check stock → 1 available ✓
User B Request (T=1ms): Check stock → 1 available ✓
User A Request (T=10ms): Reserve 1 → reservedStock=1
User B Request (T=11ms): Reserve 1 → reservedStock=2 (OVERSOLD!)
```

Both users succeeded, but we only had 1 unit. This is a race condition.

## Solution: PostgreSQL Row Locking

Instead of checking then updating, we atomically lock, check, and update:

```
User A Request (T=0ms):
  ├─ Lock Inventory row (blocks User B)
  ├─ Check stock: 1 available ✓
  ├─ Create Reservation
  ├─ Update reservedStock=1
  └─ Unlock row

User B Request (T=1ms):
  ├─ Wait for lock (A still holds it)
  ├─ Acquire lock (after A releases)
  ├─ Check stock: 0 available ✗
  └─ Return 409 Conflict
```

### Key Code

```typescript
const reservation = await prisma.$transaction(async (tx) => {
  // Lock the row - no other transaction can modify it while locked
  const inventory = await tx.$queryRaw`
    SELECT id, "totalStock", "reservedStock" 
    FROM "Inventory" 
    WHERE id = ${inventoryId} 
    FOR UPDATE  // ← This is the lock!
  `;

  // Now we have exclusive access
  const availableStock = inventory.totalStock - inventory.reservedStock;
  
  if (availableStock < quantity) {
    throw new Error("INSUFFICIENT_STOCK");
  }

  // Safe to update - no race possible
  await tx.inventory.update({
    where: { id: inventoryId },
    data: { reservedStock: { increment: quantity } }
  });

  return tx.reservation.create({ ... });
  
  // Lock automatically released when transaction commits
});
```

## PostgreSQL Transaction Isolation Levels

The system uses PostgreSQL's default isolation level: **READ COMMITTED**

```
Isolation Level      Dirty Read  Non-repeatable Read  Phantom Read
──────────────────────────────────────────────────────────────────
READ UNCOMMITTED     ✓           ✓                    ✓
READ COMMITTED       ✗           ✓                    ✓
REPEATABLE READ      ✗           ✗                    ✓
SERIALIZABLE         ✗           ✗                    ✗
```

**Row locks in READ COMMITTED** prevent:
- Dirty reads (reading uncommitted changes)
- Lost updates (our use case)
- Overselling

But CAN occur:
- Non-repeatable reads (OK - we lock when writing)
- Phantom reads (OK - we only select one inventory)

For inventory, this is perfect.

## How SELECT ... FOR UPDATE Works

```sql
SELECT * FROM "Inventory" WHERE id = '123' FOR UPDATE;
```

This SQL command:

1. **Acquires exclusive lock** on matching row
2. **Blocks** other SELECT ... FOR UPDATE queries on same row
3. **Allows** SELECT (without FOR UPDATE) queries to read stale data
4. **Automatically releases** when transaction ends (commit/rollback)

### Lock Modes

PostgreSQL has multiple lock levels:

```
FOR UPDATE       ← Exclusive lock (full write access)
FOR NO KEY UPDATE ← Exclusive lock (don't block referential integrity)
FOR SHARE        ← Shared lock (allow multiple readers)
FOR KEY SHARE    ← Shared lock (allow updates to other columns)
```

We use **FOR UPDATE** because we're modifying `reservedStock`.

## Deadlock Prevention

Deadlocks can occur if two transactions lock rows in different order:

```
Transaction A: Lock Inventory#1, then Lock Inventory#2
Transaction B: Lock Inventory#2, then Lock Inventory#1
→ DEADLOCK!
```

**Our prevention**:
1. Always lock in same order (by inventoryId)
2. Keep transactions short
3. Release locks immediately

If deadlock occurs, Prisma retries automatically.

## Performance Impact

### Lock Wait Latency

Each request adds ~10-30ms for:
- Lock acquisition: ~1-2ms
- Transaction setup: ~5-10ms
- Actual query: ~5-10ms
- Commit: ~2-5ms

```
Without locking:  ~10-20ms
With locking:     ~20-50ms
Acceptable cost!
```

### Lock Contention

High contention (many requests for same inventory):

```
100 concurrent requests for same inventory:
├─ First request: Acquires lock, ~50ms
├─ Second waits: ~40ms
├─ Third waits: ~80ms (queue)
└─ Last waits: ~3000ms (100 × 30ms)

Total queue wait: Too high!
```

**Solution**: Distribute inventory across warehouses, don't overload single SKU.

## Why Not Redis?

Redis distributed locks appear simpler but have hidden issues:

### Race Condition With Redis

```
Redis Code:
1. SET inventory:123:lock uuid (acquire lock)
2. Read current stock from Postgres
3. Check stock available
4. Update Postgres
5. DEL inventory:123:lock (release)

Problem: Stock could change between steps 2-4!
```

### Double-Write Problem

```
Write to Postgres ✓
Write to Redis lock ✗ (network failure)

→ Inconsistent state: Postgres updated but Redis still locked
```

### Clock Skew

```
Server A: GET from Postgres at T=100ms
Network delay: +50ms
Server B: Acquires Redis lock at T=95ms (earlier!)
Server B: Modifies inventory
Server A: Still has old data from 5ms earlier
```

PostgreSQL row locks avoid all these issues.

## Testing Concurrency

### Manual Test (2 Terminals)

Terminal 1:
```bash
curl -X POST http://localhost:3000/api/reservations \
  -H 'Content-Type: application/json' \
  -d '{"inventoryId":"INV123","quantity":1}'
```

Terminal 2 (start immediately after):
```bash
curl -X POST http://localhost:3000/api/reservations \
  -H 'Content-Type: application/json' \
  -d '{"inventoryId":"INV123","quantity":1}'
```

Expected:
- One succeeds (201)
- One fails (409) if stock = 1

### Automated Test (Stress Test Page)

Use the stress test simulator at `/stress-test` to:
1. Create 50 concurrent requests
2. Verify only available stock succeeds
3. Check latency distribution

### SQL Testing

Monitor locks in real-time:

```sql
-- Terminal 1: Start transaction and lock
BEGIN;
SELECT * FROM "Inventory" WHERE id = '123' FOR UPDATE;
-- Don't commit yet!

-- Terminal 2: Try to lock same row
SELECT * FROM "Inventory" WHERE id = '123' FOR UPDATE;
-- This will WAIT!

-- Terminal 1: Release lock
COMMIT;

-- Terminal 2: Now acquires lock and continues
```

## Confirmation Flow Concurrency

The confirmation also uses row locking:

```typescript
await prisma.$transaction(async (tx) => {
  // Lock inventory for reading confirmed stock count
  const inventory = await tx.$queryRaw`
    SELECT * FROM "Inventory" WHERE id = ${inventoryId} FOR UPDATE
  `;
  
  // Atomically deduct from both totalStock and reservedStock
  await tx.inventory.update({
    where: { id: inventoryId },
    data: {
      totalStock: { decrement: quantity },       // Permanent loss
      reservedStock: { decrement: quantity },    // Release hold
    }
  });
});
```

This prevents:
- Confirming same reservation twice (204 already exists check)
- Dequoting wrong quantity (transactional atomicity)
- Inventory going negative (happens in single query)

## Idempotency + Concurrency

Idempotency keys add another layer:

```
Request comes in with key: "abc123"
├─ Check IdempotencyKey table
├─ If exists: return cached response (409 even if retry!)
└─ If new:
   ├─ Acquire inventory lock
   ├─ Try reservation
   └─ If fails, DON'T cache (retry later)
```

This prevents:
- Duplicate reservations on network retry
- Duplicate confirmations
- Stuck state from partial failures

## Common Misconceptions

### "Multiple rows from same inventory?"

```
SELECT * FROM "Inventory" WHERE productId = '1' FOR UPDATE;
```

This locks **all** rows matching the condition, not just one.

✅ **Good**: Lock specific inventory by ID
```sql
WHERE id = '123' FOR UPDATE;
```

### "Row locking = table locking?"

No! PostgreSQL locks individual rows, not the table.

```
Request 1: Lock Inventory#1
Request 2: Lock Inventory#2 ✓ (different row, no wait)
Request 3: Lock Inventory#1 ✗ (same row, must wait)
```

### "Lock lasts until commit?"

Exactly! Lock scope = transaction scope.

```sql
BEGIN;
SELECT ... FOR UPDATE;  -- Acquire lock
-- (lock held here)
COMMIT;                 -- Release lock
```

### "Does SELECT see locked rows?"

Yes! Locks don't prevent reading.

```sql
SELECT ... FOR UPDATE;     -- Lock rows
SELECT ... (no FOR UPDATE) -- Can read locked rows!
```

This is intentional - we want confirmations to see locked data.

## Conclusion

Row-level locking with PostgreSQL transactions is:
- ✅ Simple and proven
- ✅ Correctly prevents overselling
- ✅ Works reliably across network failures
- ✅ No external dependencies
- ✅ Battle-tested in payment systems

The 20-30ms latency cost is negligible for the correctness guarantee.

---

**Further Reading**:
- PostgreSQL Docs: [Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- Prisma: [Transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)
- Database Design: "Database Internals" by Alex Petrov
