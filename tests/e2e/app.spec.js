const { test, expect } = require('@playwright/test');
const { startDemo } = require('./helpers');

test('protected routes redirect to sign in, then return after creating a profile', async ({ page }) => {
  await page.goto('/#/app/progress');
  await expect(page.getByRole('heading', { level: 1, name: /Sign in|Create a profile/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Create profile' }).click();
  await page.getByRole('button', { name: 'Create profile and start' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'at least 2 characters' })).toBeVisible();
  await page.getByLabel('Display name').fill('Asha Rao');
  await page.getByRole('button', { name: 'Create profile and start' }).click();
  await expect(page).toHaveURL(/#\/app\/progress/);
  await expect(page.getByText('Mastery over time')).toBeVisible();
});

test('sign out and sign back in keeps progress', async ({ page }) => {
  await page.goto('/#/signin');
  await page.getByRole('tab', { name: 'Create profile' }).click();
  await page.getByLabel('Display name').fill('Bilal');
  await page.getByRole('button', { name: 'Create profile and start' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Welcome, Bilal');
  await page.evaluate(() => MT.ui.store.observe('eee-transformers', 'ohms_law', true, {}));
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/#\/$/);
  await page.goto('/#/app/dashboard');
  await page.getByRole('button', { name: /Bilal/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Welcome, Bilal');
  expect(await page.evaluate(() => MT.ui.store.record('eee-transformers', 'ohms_law').obs)).toBe(1);
});

test('profile names with markup are shown as text, never executed', async ({ page }) => {
  let dialogs = 0;
  page.on('dialog', (d) => { dialogs++; d.dismiss(); });
  await page.goto('/#/signin');
  await page.getByRole('tab', { name: 'Create profile' }).click();
  await page.getByLabel('Display name').fill('<img src=x onerror=alert(1)>Eve');
  await page.getByRole('button', { name: 'Create profile and start' }).click();
  await expect(page.locator('.profile-chip .pname')).toHaveText('<img src=x onerror=alert(1)>Eve');
  await expect(page.locator('.sidebar img')).toHaveCount(0);
  expect(dialogs).toBe(0);
});

test('a new profile starts with honest empty states, not sample data', async ({ page }) => {
  await page.goto('/#/signin');
  await page.getByRole('tab', { name: 'Create profile' }).click();
  await page.getByLabel('Display name').fill('Newcomer');
  await page.getByRole('button', { name: 'Create profile and start' }).click();
  await expect(page.getByText('No activity yet')).toBeVisible();
  await expect(page.locator('.stat .num').first()).toHaveText('0');
  await page.getByRole('link', { name: 'Progress' }).click();
  await expect(page.getByText('No estimate updates yet')).toBeVisible();
  await expect(page.getByText('These are estimates, not grades.')).toBeVisible();
});

test('settings: rename, theme persists across reload, reset needs confirmation', async ({ page }) => {
  await startDemo(page);
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByLabel('Display name').fill('Judge Two');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.locator('.profile-chip .pname')).toHaveText('Judge Two');

  await page.getByLabel('Theme', { exact: true }).selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.evaluate(() => MT.ui.store.observe('eee-transformers', 'ohms_law', true, {}));
  await page.getByRole('button', { name: 'Reset progress' }).click();
  await expect(page.getByRole('alertdialog', { name: 'Reset all progress?' })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => MT.ui.store.events().length)).toBe(1);
  await page.getByRole('button', { name: 'Reset progress' }).click();
  await page.getByRole('button', { name: 'Reset progress' }).last().click();
  await expect.poll(() => page.evaluate(() => MT.ui.store.events().length)).toBe(0);
});

test('the Gemini key is never placed in an export', async ({ page }) => {
  await startDemo(page);
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByLabel('Gemini API key').fill('TEST-KEY-NOT-REAL');
  await page.getByLabel(/Ask Gemini/).check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export as JSON' }).click();
  const path = await (await download).path();
  const text = require('node:fs').readFileSync(path, 'utf8');
  expect(text).not.toContain('TEST-KEY-NOT-REAL');
  expect(JSON.parse(text).name).toBe('Judge demo');
});

test('explorer lists every domain and opens a problem', async ({ page }) => {
  await startDemo(page);
  await page.getByRole('link', { name: 'Explorer' }).click();
  for (const d of ['JEE Physics', 'JEE Chemistry', 'JEE Mathematics', 'NEET Biology', 'GATE Computer Science', 'First-year Engineering']) {
    await expect(page.getByRole('heading', { level: 2, name: d })).toBeVisible();
  }
  await page.getByRole('button', { name: 'NEET Biology' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'JEE Physics' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Open' }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Carrier frequency');
});
