const { test, expect } = require('@playwright/test');
const { startDemo, openModes } = require('./helpers');

const events = (page) => page.evaluate(() => MT.ui.store.events().map((e) => e.type));

test('hints come in three levels, show no answer and change no estimate', async ({ page }) => {
  await startDemo(page);
  await openModes(page);
  await page.getByRole('button', { name: 'Give me a hint' }).click();
  for (const label of ['Show a hint', 'Another hint (2 of 3)', 'Another hint (3 of 3)']) await page.getByRole('button', { name: label }).click();
  await expect(page.getByTestId('hints').locator('li')).toHaveCount(3);
  await expect(page.getByText('Think about:')).toBeVisible();
  await expect(page.getByText('That is all three hints')).toBeVisible();
  expect((await events(page)).filter((t) => t === 'HINT')).toHaveLength(3);
  expect((await events(page)).filter((t) => t === 'OBSERVATION')).toHaveLength(0);
  await expect(page.locator('main')).not.toContainText(/\b2 A\b/);
});

test('explain mode gives the explanation first, with an optional check', async ({ page }) => {
  await startDemo(page);
  await openModes(page);
  await page.getByRole('button', { name: 'Explain this concept' }).click();
  await page.getByRole('button', { name: 'Explain it' }).click();
  await expect(page.getByRole('heading', { name: 'The concept' })).toBeVisible();
  await expect(page.getByText('Common trap')).toBeVisible();
  await expect(page.getByText('no questions first')).toBeVisible();
  const right = await page.evaluate(() => {
    const id = new URLSearchParams(location.hash.split('?')[1]).get('session');
    const c = MT.flow.currentExplainCheck(MT.ui.store.getSession(id));
    return c.mcq.options.find((o) => o.index === c.concept.practice.correct).text;
  });
  await page.getByLabel(right, { exact: true }).check();
  await page.getByRole('button', { name: 'Check my understanding' }).click();
  await expect(page.getByText('Quick check passed.')).toBeVisible();
  await page.getByRole('button', { name: 'Back to the problem' }).click();
  await expect(page.getByRole('button', { name: 'Submit attempt' })).toBeVisible();
});

test('teach from the basics walks the prerequisites in order', async ({ page }) => {
  await startDemo(page);
  await openModes(page);
  await page.getByRole('button', { name: 'Teach me from the basics' }).click();
  await page.getByRole('button', { name: 'Teach me from the basics' }).last().click();
  await expect(page.getByRole('heading', { name: 'From the basics up' })).toBeVisible();
  const names = await page.locator('#stage h4').allInnerTexts();
  expect(names).toHaveLength(6);
  expect(names[names.length - 1]).toMatch(/Ideal transformer numericals/);
  expect(names.findIndex((n) => /Formula rearrangement/.test(n))).toBeLessThan(names.findIndex((n) => /Turns, voltage/.test(n)));
});

test('a short right answer to an open question needs a reasoning check before it counts', async ({ page }) => {
  await startDemo(page);
  await page.getByRole('link', { name: 'Ask anything' }).click();
  await page.getByRole('button', { name: 'Open the demo question' }).click();
  await page.getByLabel('Your answer').fill('Reparations and resentment.');
  await page.getByRole('button', { name: 'Submit attempt' }).click();
  await expect(page.getByRole('heading', { name: 'Right answer. One quick check' })).toBeVisible();
  await expect(page.getByText('nothing is credited yet')).toBeVisible();
  expect((await events(page)).filter((t) => t === 'OBSERVATION')).toHaveLength(0);
  await page.getByLabel('How did you get there?').fill('The treaty forced reparations that wrecked the economy, and that resentment helped the Nazis and Hitler.');
  await page.getByRole('button', { name: 'Submit my reasoning' }).click();
  await expect(page.getByRole('heading', { name: 'Correct' })).toBeVisible();
  expect((await events(page)).filter((t) => t === 'RUBRIC').length).toBeGreaterThan(0);
});

test('an uncertain dependency is drawn dotted and explained on the map', async ({ page }) => {
  await startDemo(page);
  await page.getByRole('link', { name: 'Ask anything' }).click();
  await page.getByRole('button', { name: 'Open the demo question' }).click();
  await page.getByRole('link', { name: 'Open full map' }).click();
  await expect(page.locator('.gv-edge.uncertain')).toHaveCount(1);
  await page.locator('.gv-node[data-id="resentment"]').click();
  await expect(page.getByText('uncertain relationship')).toBeVisible();
});

test.describe('clarification', () => {
  test('a calculation without values asks for them and does not build a map', async ({ page }) => {
    await startDemo(page);
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByLabel('Gemini API key').fill('TEST-KEY-NOT-REAL');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    let calls = 0;
    await page.route('https://generativelanguage.googleapis.com/**', (r) => { calls++; return r.abort(); });
    await page.getByRole('link', { name: 'Ask anything' }).click();
    await page.getByLabel('What do you want to understand or answer?').fill('Calculate the current flowing through the resistor in the circuit.');
    await page.getByRole('button', { name: 'Build my learning map' }).click();
    await expect(page.getByText('One quick question first.')).toBeVisible();
    await expect(page.getByText('values given in the problem')).toBeVisible();
    expect(calls).toBe(0);
    expect(await page.evaluate(() => MT.ui.store.customTracks().length)).toBe(0);
    await page.getByLabel('Your answer to that').fill('The voltage is 12 V and the resistance is 4 ohms.');
    await page.getByRole('button', { name: 'Build my learning map' }).click();
    await expect.poll(() => calls).toBeGreaterThan(0);
  });
});
