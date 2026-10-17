const { test, expect } = require('@playwright/test');
const { startDemo, node } = require('./helpers');

test.describe('knowledge gap map', () => {
  test.beforeEach(async ({ page }) => {
    await startDemo(page);
    await page.getByRole('link', { name: 'Gap map' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Single-phase transformers');
  });

  test('selecting a node updates the details panel and highlights dependencies', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 2, name: 'Ideal transformer numericals' })).toBeVisible();
    await node(page, 'turns_ratio').click();
    await expect(page).toHaveURL(/concept=turns_ratio/);
    await expect(page.getByRole('heading', { level: 2, name: 'Turns, voltage and current ratios' })).toBeVisible();
    await expect(page.getByText('Prerequisites')).toBeVisible();
    await expect(page.locator('.gv-edge.hl-up').first()).toBeVisible();
    await expect(page.locator('.gv-edge.hl-down').first()).toBeVisible();
    await expect(node(page, 'unit_conv')).toHaveClass(/dim/);
  });

  test('zoom and fit controls change the viewport transform', async ({ page }) => {
    const vp = page.locator('.gv-viewport');
    const fitted = await vp.getAttribute('transform');
    await page.getByRole('button', { name: 'Zoom in' }).click();
    const zoomed = await vp.getAttribute('transform');
    expect(zoomed).not.toBe(fitted);
    await page.getByRole('button', { name: 'Fit graph to view' }).click();
    expect(await vp.getAttribute('transform')).toBe(fitted);
  });

  test('dragging the background pans the graph and does not select a node', async ({ page }) => {
    const vp = page.locator('.gv-viewport');
    const before = await vp.getAttribute('transform');
    const box = await page.locator('.gv-svg').boundingBox();
    await page.mouse.move(box.x + 12, box.y + box.height - 12);
    await page.mouse.down();
    await page.mouse.move(box.x + 90, box.y + box.height - 60, { steps: 6 });
    await page.mouse.up();
    expect(await vp.getAttribute('transform')).not.toBe(before);
    await expect(page).not.toHaveURL(/concept=/);
  });

  test('nodes are keyboard operable', async ({ page }) => {
    await node(page, 'faraday').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/concept=faraday/);
    await expect(page.getByRole('heading', { level: 2, name: /Faraday/ })).toBeVisible();
  });

  test('a non-mastered concept offers recovery that opens a lesson', async ({ page }) => {
    await node(page, 'alg_rearrange').click();
    await page.getByRole('button', { name: 'Recover and verify this concept' }).click();
    await expect(page).toHaveURL(/workspace\?session=/);
    await expect(page.getByRole('heading', { name: /^Recover: Formula rearrangement/ })).toBeVisible();
  });

  test('the table alternative lists every concept', async ({ page }) => {
    await page.getByText('Concept list (accessible alternative').click();
    await expect(page.locator('table.tbl tbody tr')).toHaveCount(6);
  });

  test('switching topic loads that track\'s graph', async ({ page }) => {
    await page.getByLabel('Topic').selectOption('jee-pulley');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Rotational dynamics');
    await expect(node(page, 'pulley_dynamics')).toBeVisible();
  });
});
