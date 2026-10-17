const { test, expect } = require('@playwright/test');
const { startDemo } = require('./helpers');

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('no horizontal scrolling on any page at phone width', async ({ page }) => {
  await page.goto('/');
  expect(await overflow(page)).toBe(0);
  await page.goto('/#/signin');
  expect(await overflow(page)).toBe(0);
  await startDemo(page);
  for (const hash of ['dashboard', 'workspace?track=jee-pulley&problem=pulley-acceleration', 'map?track=gate-subnet', 'progress', 'explore', 'settings']) {
    await page.goto('/#/app/' + hash);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await overflow(page), hash).toBe(0);
  }
});

test('the navigation drawer opens, navigates and closes', async ({ page }) => {
  await startDemo(page);
  const menu = page.getByRole('button', { name: 'Open navigation' });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('link', { name: 'Gap map' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Single-phase transformers');
  await expect(page.locator('body')).not.toHaveClass(/nav-open/);
});

test('the diagnostic loop works on a phone', async ({ page }) => {
  await startDemo(page);
  await page.getByRole('button', { name: 'Fill in the demo wrong attempt' }).click();
  await page.getByRole('button', { name: 'Submit attempt' }).click();
  await expect(page.getByRole('heading', { name: 'Diagnosis' })).toBeVisible();
  await page.getByLabel('1000 V').check();
  await page.getByRole('button', { name: 'Submit probe answer' }).click();
  await expect(page.getByRole('heading', { name: 'Gap confirmed' })).toBeVisible();
});
