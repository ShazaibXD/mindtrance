const { test, expect } = require('@playwright/test');
const { startDemo, submitDemoAttempt } = require('./helpers');

const watchErrors = (page) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  return errs;
};

test.describe('with motion enabled', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('the landing page mounts smooth scroll, split-text, the Vanta network and scroll reveals without errors', async ({ page }) => {
    const errs = watchErrors(page);
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/\bfx\b/);
    await expect(page.locator('html')).toHaveClass(/\blenis\b/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveAttribute('aria-label', 'Find the gap. Fix the foundation.');
    expect(await page.locator('h1 .w-in').count()).toBeGreaterThan(4);
    await expect(page.locator('.hero-bg canvas')).toHaveCount(1, { timeout: 8000 });
    await expect(page.locator('.hero-bg')).toHaveClass(/has-vanta/);
    await page.mouse.move(700, 400);
    await page.mouse.wheel(0, 3200);
    await expect.poll(() => page.locator('.tl-step.on').count(), { timeout: 8000 }).toBeGreaterThan(0);
    await page.mouse.wheel(0, 3000);
    await expect(page.locator('[data-gauge]').first()).toBeVisible();
    expect(errs).toEqual([]);
  });

  test('the Vanta canvas is released when the hero scrolls out of view', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero-bg canvas')).toHaveCount(1, { timeout: 8000 });
    await page.evaluate(() => document.getElementById('how').scrollIntoView());
    await expect(page.locator('.hero-bg canvas')).toHaveCount(0, { timeout: 8000 });
  });

  test('switching theme re-colours the network instead of breaking it', async ({ page }) => {
    const errs = watchErrors(page);
    await page.goto('/');
    await expect(page.locator('.hero-bg canvas')).toHaveCount(1, { timeout: 8000 });
    await page.getByRole('button', { name: 'Toggle light or dark theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('.hero-bg canvas')).toHaveCount(1, { timeout: 8000 });
    expect(errs).toEqual([]);
  });

  test('without WebGL the page still renders in full and nothing throws', async ({ page }) => {
    const errs = watchErrors(page);
    await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try the judge demo' })).toBeVisible();
    await expect(page.locator('.hero-bg canvas')).toHaveCount(0);
    expect(errs).toEqual([]);
  });

  test('the whole diagnostic loop still works while pages animate in', async ({ page }) => {
    const errs = watchErrors(page);
    await startDemo(page);
    await submitDemoAttempt(page);
    await page.getByLabel('1000 V').check();
    await page.getByRole('button', { name: 'Submit probe answer' }).click();
    await expect(page.getByRole('heading', { name: 'Gap confirmed' })).toBeVisible();
    await page.getByRole('link', { name: 'Gap map' }).click();
    await expect(page.locator('.gv-node[data-id="turns_ratio"]')).toHaveClass(/st-CONFIRMED_GAP/);
    // after the entrance animation every node ends fully opaque and every edge loses its drawing dash
    await expect.poll(() => page.locator('.gv-node').evaluateAll((els) => els.every((e) => Number(getComputedStyle(e).opacity) > 0.99)), { timeout: 6000 }).toBe(true);
    await expect.poll(() => page.locator('.gv-edge').evaluateAll((els) => els.every((e) => !e.style.strokeDashoffset)), { timeout: 6000 }).toBe(true);
    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page.locator('.stat .num').first()).toHaveText('1', { timeout: 6000 });
    expect(errs).toEqual([]);
  });

  test('graph interaction is not hijacked by smooth scroll', async ({ page }) => {
    await startDemo(page);
    await page.getByRole('link', { name: 'Gap map' }).click();
    const vp = page.locator('.gv-viewport');
    await expect.poll(() => vp.getAttribute('transform')).not.toBeNull();
    const before = await vp.getAttribute('transform');
    const box = await page.locator('.gv-svg').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -400);
    await page.keyboard.up('Control');
    await expect.poll(() => vp.getAttribute('transform')).not.toBe(before);
  });
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('everything is plain, visible and immediate', async ({ page }) => {
    const errs = watchErrors(page);
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveClass(/\bfx\b/);
    await expect(page.locator('html')).not.toHaveClass(/\blenis\b/);
    expect(await page.locator('.w-in').count()).toBe(0);
    await expect(page.locator('.hero-bg canvas')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Find the gap\.\s*Fix the foundation\./);
    for (const sel of ['.tl-step', '.tier', '.domain', '.fact']) {
      const n = await page.locator(sel).count();
      expect(n, sel).toBeGreaterThan(0);
      expect(await page.locator(sel).evaluateAll((els) => els.every((e) => Number(getComputedStyle(e).opacity) >= 0.4)), sel).toBe(true);
    }
    expect(await page.locator('[data-gauge]').first().evaluate((e) => getComputedStyle(e).transform)).toBe('none');
    expect(errs).toEqual([]);
  });
});
