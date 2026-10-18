const { test, expect } = require('@playwright/test');
const { startDemo } = require('./helpers');

const tour = (page) => page.getByRole('complementary', { name: 'Guided demo' });
const step = (page, n) => expect(tour(page).locator('.tour-count')).toHaveText('Step ' + n + ' of 9');

test('a first-time visitor can finish the whole demo using only what the tour says', async ({ page }) => {
  await startDemo(page);

  await step(page, 1);
  await expect(tour(page).getByText('The correct answer is hidden on purpose')).toBeVisible();
  await expect(page.locator('#a-ans')).toHaveClass(/tour-focus/);
  await tour(page).getByRole('button', { name: 'Fill in the demo wrong attempt' }).click();

  await step(page, 2);
  await expect(page.locator('[data-fk="attempt-submit"]')).toHaveClass(/tour-focus/);
  await page.getByRole('button', { name: 'Submit attempt' }).click();

  await step(page, 3);
  await expect(tour(page).getByText('thin evidence')).toBeVisible();
  await expect(page.locator('#stage').getByText('In plain words:')).toBeVisible();
  await tour(page).getByRole('button', { name: 'Answer as the student would' }).click();
  await expect(tour(page).getByText('Now press Submit probe answer.')).toBeVisible();
  await page.getByRole('button', { name: 'Submit probe answer' }).click();

  await step(page, 4);
  await expect(tour(page).getByText(/fell from 0\.\d\d to 0\.\d\d/)).toBeVisible();
  await expect(page.locator('[data-fk="start-recovery"]')).toHaveClass(/tour-focus/);
  await page.getByRole('button', { name: 'Start recovery' }).click();

  await step(page, 5);
  await page.getByRole('button', { name: /I have read this/ }).click();

  await step(page, 6);
  await tour(page).getByRole('button', { name: 'Pick the right answer for me' }).click();
  await page.getByRole('button', { name: 'Check answer' }).click();
  await page.getByRole('button', { name: 'Go to verification' }).click();

  for (let i = 0; i < 3; i++) {
    await expect(tour(page).locator('.tour-count')).toHaveText(/Step (7|8) of 9/);
    if ((await tour(page).locator('.tour-count').textContent()) === 'Step 8 of 9') break;
    await tour(page).getByRole('button', { name: 'Fill in the answer for me' }).click();
    const before = await page.locator('form[data-form=verify] .problem-text').innerText();
    await page.getByRole('button', { name: 'Submit for verification' }).click();
    await expect.poll(async () => (await tour(page).locator('.tour-count').textContent()) === 'Step 8 of 9' || (await page.locator('form[data-form=verify] .problem-text').innerText().catch(() => before)) !== before).toBe(true);
  }
  await step(page, 8);
  await expect(tour(page).getByText(/went from 0\.\d\d to 0\.\d\d/)).toBeVisible();
  await page.getByRole('button', { name: 'Retry the original problem' }).click();

  await step(page, 9);
  await tour(page).getByRole('button', { name: 'Fill in the correct answer' }).click();
  await expect(page.getByLabel('Final answer')).toHaveValue('2 A');
  await page.getByRole('button', { name: 'Submit attempt' }).click();

  await expect(tour(page).getByRole('heading', { name: 'That is the whole loop' })).toBeVisible();
  await expect(tour(page).locator('.tour-list li')).toHaveCount(5);
  await expect(tour(page).getByRole('link', { name: 'Ask your own question' })).toBeVisible();
});

test('the tour can be hidden and shown again, and the replay shortcut shows the strong-evidence path', async ({ page }) => {
  await startDemo(page);
  await tour(page).getByRole('button', { name: 'Hide tour' }).click();
  await expect(tour(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Show the guided demo' }).click();
  await step(page, 1);
  await tour(page).getByRole('button', { name: 'Fill in with working' }).click();
  await expect(page.getByLabel(/Working steps/)).toHaveValue(/2400 V/);
  await page.getByRole('button', { name: 'Submit attempt' }).click();
  await step(page, 4);
  await expect(tour(page).getByText('no extra question was needed')).toBeVisible();
});

test('the demo hides the seven mode buttons until asked, and leaves other problems untouched', async ({ page }) => {
  await startDemo(page);
  await expect(page.getByRole('button', { name: 'Give me a hint' })).toBeHidden();
  await page.getByText('Other ways to get help').click();
  await expect(page.getByRole('button', { name: 'Give me a hint' })).toBeVisible();
  await page.goto('/#/app/workspace?track=gate-subnet&problem=subnet-hosts-26');
  await expect(tour(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Give me a hint' })).toBeVisible();
});

test('a normal profile never sees the tour', async ({ page }) => {
  await page.goto('/#/signin');
  await page.getByRole('tab', { name: 'Create profile' }).click();
  await page.getByLabel('Display name').fill('Regular');
  await page.getByRole('button', { name: 'Create profile and start' }).click();
  await page.goto('/#/app/workspace?track=eee-transformers&problem=tx-secondary-current');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Secondary current');
  await expect(tour(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Give me a hint' })).toBeVisible();
});
