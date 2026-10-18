const { test, expect } = require('@playwright/test');
const { startDemo } = require('./helpers');

test('a first-time visitor is oriented: first-run steps, a guide page, and a dismissible page intro', async ({ page }) => {
  await page.goto('/#/signin');
  await page.getByRole('tab', { name: 'Create profile' }).click();
  await page.getByLabel('Display name').fill('Newcomer');
  await page.getByRole('button', { name: 'Create profile and start' }).click();
  await expect(page.getByRole('heading', { name: 'Four steps, about three minutes' })).toBeVisible();

  await page.getByRole('link', { name: 'How it works' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'How MINDTRACE works' })).toBeVisible();
  for (const t of ['Slip', 'Gap', 'Probe', 'Evidence score', 'Mastery estimate', 'Fresh problem']) {
    await expect(page.locator('.gterm dt', { hasText: t }).first()).toBeVisible();
  }
  await expect(page.getByText('Provisionally mastered')).toBeVisible(); // the status legend

  await page.getByRole('link', { name: 'Explorer' }).click();
  await expect(page.getByRole('heading', { name: 'What you can open here' })).toBeVisible();
  await page.getByRole('button', { name: 'Got it, hide this' }).click();
  await expect(page.getByRole('heading', { name: 'What you can open here' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'What is this page?' })).toBeVisible(); // remembered, and reversible
  await page.getByRole('button', { name: 'What is this page?' }).click();
  await expect(page.getByRole('heading', { name: 'What you can open here' })).toBeVisible();
});

test('the map explains how to read it without hiding the graph', async ({ page }) => {
  await startDemo(page);
  await page.getByRole('link', { name: 'Gap map' }).click();
  await expect(page.getByRole('list', { name: 'Colour key' })).toBeVisible();
  await expect(page.getByText('each box is one concept')).toBeVisible();
  const box = await page.locator('.gv-svg').boundingBox();
  expect(box.y + box.height).toBeLessThan(page.viewportSize().height);
});
