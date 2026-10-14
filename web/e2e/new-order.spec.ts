import { expect, test } from '@playwright/test';

test('the expeditor creates an order from the + button and it joins the queue', async ({ page }) => {
  const customerName = `E2E ${Date.now()}`;

  await page.goto('/');
  await page.getByRole('button', { name: 'New order' }).click();

  const dialog = page.getByRole('dialog', { name: 'New order' });
  await dialog.getByLabel('Customer name').fill(customerName);
  await dialog.getByLabel('Type').selectOption('takeout');
  await dialog.getByLabel('Promised in (minutes)').fill('20');
  await dialog.getByLabel('Menu item').selectOption({ label: 'Beef Burger' });
  await dialog.getByLabel('Quantity').fill('2');
  await dialog.getByRole('button', { name: 'Create order' }).click();

  await expect(dialog).toBeHidden();
  const row = page.getByRole('row').filter({ hasText: customerName });
  await expect(row).toContainText('received');
  await expect(row).toContainText('2× Beef Burger');
});
