// @ts-nocheck
import { test, expect } from '@playwright/test';

test('dashboard loads and shows AI command center', async ({ page }) => {
  // Use deployed dashboard so tests run without local dev server
  await page.goto('https://allo-inventory-app-22mic7141-7s2kx54vv-nupoor-kumaris-projects.vercel.app/dashboard', { waitUntil: 'networkidle' });

  // Check for AI command center input placeholder
  const input = page.locator('input[placeholder*="Which products are low in stock"]');
  await expect(input).toBeVisible();

  // Check that the Ask AI button exists
  await expect(page.getByRole('button', { name: /Ask AI/i })).toBeVisible();

  // Check reservations list loads
  await expect(page.getByText(/Reservations/i)).toBeVisible();
});
