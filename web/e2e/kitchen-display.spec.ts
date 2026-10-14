import { expect, test } from '@playwright/test';

test('the expeditor starts preparing a seeded order', async ({ page }) => {
  await page.goto('/');

  // Any seeded order still in "received" status has a Start button.
  const firstReceivedRow = page
    .getByRole('row')
    .filter({ has: page.getByRole('button', { name: 'Start' }) })
    .first();
  await expect(firstReceivedRow).toBeVisible();

  // Customer names in the seed are unique, so the name identifies the row after the table re-sorts.
  const customerName = await firstReceivedRow.getByRole('cell').nth(1).innerText();
  const orderRow = page.getByRole('row').filter({ hasText: customerName });
  await expect(orderRow).toContainText('received');

  await orderRow.getByRole('button', { name: 'Start' }).click();

  await expect(orderRow).toContainText('preparing');
  await expect(orderRow.getByRole('button', { name: 'Mark ready' })).toBeVisible();
  await expect(orderRow.getByRole('button', { name: 'Start' })).toHaveCount(0);
});
