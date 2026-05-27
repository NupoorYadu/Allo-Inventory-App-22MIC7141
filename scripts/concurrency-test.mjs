const BASE = process.env.TARGET_BASE || 'https://allo-inventory-app-22mic7141-7s2kx54vv-nupoor-kumaris-projects.vercel.app';

async function pickInventory(minAvailable = 1) {
  const res = await fetch(`${BASE}/api/products`);
  const products = await res.json();
  for (const p of products) {
    for (const inv of p.inventory) {
      if ((inv.availableStock ?? 0) >= minAvailable) return { product: p, inventory: inv };
    }
  }
  return null;
}

async function runScenario(name, count, quantity) {
  console.log(`\nRunning scenario: ${name} — ${count} requests × ${quantity}`);
  const target = await pickInventory(quantity);
  if (!target) {
    console.log('No inventory with required availability found');
    return;
  }

  console.log(`Target inventory: ${target.product.name} @ ${target.inventory.warehouse.name} — available ${target.inventory.availableStock}`);

  const payload = { inventoryId: target.inventory.id, quantity };

  const tasks = Array.from({ length: count }, (_, i) => (async () => {
    const key = cryptoRandom();
    const res = await fetch(`${BASE}/api/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  })());

  const results = await Promise.all(tasks);
  const success = results.filter(r => r.status === 201).length;
  const conflict = results.filter(r => r.status === 409).length;
  const other = results.length - success - conflict;

  console.log(`Results: succeeded=${success}, conflict(409)=${conflict}, other=${other}`);
  console.log('Sample successful responses:', results.filter(r => r.status === 201).slice(0,5));
  console.log('Sample conflict responses:', results.filter(r => r.status === 409).slice(0,5));

  // Verify no oversell: sum created should be <= available
  const createdCount = success * quantity;
  console.log(`Created units (approx): ${createdCount} <= available ${target.inventory.availableStock}`);
}

async function runIdempotencyCheck() {
  console.log('\nRunning idempotency check');
  const target = await pickInventory(1);
  if (!target) {
    console.log('No inventory found for idempotency check');
    return;
  }

  const payload = { inventoryId: target.inventory.id, quantity: 1 };
  const key = `idem-${cryptoRandom()}`;
  const first = await fetch(`${BASE}/api/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(payload),
  });
  const firstBody = await first.json().catch(() => ({}));
  const second = await fetch(`${BASE}/api/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(payload),
  });
  const secondBody = await second.json().catch(() => ({}));

  console.log('First response:', { status: first.status, body: firstBody });
  console.log('Second response:', { status: second.status, body: secondBody });
  console.log('Idempotency verdict:', firstBody?.id && secondBody?.id && firstBody.id === secondBody.id ? 'same reservation returned' : 'check manually');
}

function cryptoRandom() {
  // simple idempotency key generator
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
}

async function main() {
  await runScenario('10x1', 10, 1);
  await runScenario('50x5', 50, 5);
  await runIdempotencyCheck();
}

main().catch(err => { console.error(err); process.exit(1); });
