const { test, expect } = require('@playwright/test');
const { startDemo, submitDemoAttempt, failProbe, recoverToVerification, solveVerification, node } = require('./helpers');

test('acceptance journey: wrong attempt to verified mastery, graph updates, persistence', async ({ page }) => {
  await startDemo(page);

  // 1-3. wrong attempt, diagnosis with evidence, no answer leak
  await submitDemoAttempt(page);
  const stage = page.locator('#stage');
  await expect(stage.getByText('Suspected prerequisite gap')).toBeVisible();
  await expect(stage.getByText('suspected, not confirmed')).toBeVisible();
  await expect(stage.getByText(/applied upside down/)).toBeVisible();
  await expect(stage.getByText('Rule-based engine (deterministic, no AI)')).toBeVisible();
  await expect(stage).not.toContainText('Worked solution');
  await expect(node(page, 'turns_ratio')).toHaveClass(/st-SUSPECTED_GAP/);

  // 4-5. probe fails, gap confirmed, target blocked
  await failProbe(page);
  await expect(node(page, 'turns_ratio')).toHaveClass(/st-CONFIRMED_GAP/);
  await expect(node(page, 'ideal_tx')).toHaveClass(/st-BLOCKED/);

  // 6-7. recovery with the misconception named and personalised
  await page.getByRole('button', { name: 'Start recovery' }).click();
  await expect(page.getByText('What your answer showed')).toBeVisible();
  await expect(page.getByText('Common misconception')).toBeVisible();
  await expect(page.getByText('Worked example')).toBeVisible();
  await page.getByRole('button', { name: /I have read this/ }).click();
  await page.getByLabel('100 V', { exact: true }).check();
  await page.getByRole('button', { name: 'Check answer' }).click();
  await page.getByRole('button', { name: 'Go to verification' }).click();

  // 8-9. fresh problem, different from the original
  await expect(page.getByRole('heading', { name: 'Fresh verification problem' })).toBeVisible();
  await expect(page.getByText('new numbers')).toBeVisible();
  await expect(page.locator('form[data-form=verify] .problem-text')).not.toContainText('N1/N2 = 10. The primary is connected to V1 = 240 V');
  await solveVerification(page);

  // 10. mastery updated, graph updated, original unlocked
  await expect(page.getByText('Verified.', { exact: false }).first()).toBeVisible();
  await expect(node(page, 'turns_ratio')).toHaveClass(/st-MASTERED/);
  await expect(node(page, 'ideal_tx')).not.toHaveClass(/st-BLOCKED/);

  // retry the original and solve it
  await page.getByRole('button', { name: 'Retry the original problem' }).click();
  await expect(page.getByLabel('Final answer')).toHaveValue('');
  await page.getByLabel('Final answer').fill('2 A');
  await page.getByRole('button', { name: 'Submit attempt' }).click();
  await expect(page.getByRole('heading', { name: 'Correct' })).toBeVisible();
  await expect(page.getByText('Worked solution')).toBeVisible();

  // 11. persistence after a refresh
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Correct' })).toBeVisible();

  // the map and dashboard reflect the evidence
  await page.getByRole('link', { name: 'Gap map' }).click();
  await expect(node(page, 'turns_ratio')).toHaveClass(/st-MASTERED/);
  await page.getByRole('link', { name: 'Progress' }).click();
  await expect(page.getByText('Mastery over time')).toBeVisible();
  await expect(page.locator('svg.chart').first()).toBeVisible();
  await page.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.getByText('Confirmed gaps').first()).toBeVisible();
});

test('the original problem stays locked while a gap is confirmed', async ({ page }) => {
  await startDemo(page);
  await submitDemoAttempt(page);
  await failProbe(page);
  await page.goto('/#/app/workspace?track=eee-transformers&problem=tx-kv-primary');
  await expect(page.getByText('Locked until the gap is repaired')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit attempt' })).toBeDisabled();
});

test('a failed verification returns to the lesson and the gap stays open', async ({ page }) => {
  await startDemo(page);
  await submitDemoAttempt(page);
  await failProbe(page);
  await recoverToVerification(page);
  // answer with the inverted-ratio signature of the verification problem
  const wrong = await page.evaluate(() => {
    const id = new URLSearchParams(location.hash.split('?')[1]).get('session');
    const vp = MT.flow.verificationProblem(MT.ui.store.getSession(id));
    return vp.patterns.find((p) => /upside down/.test(p.evidence)).value + ' A';
  });
  await page.locator('#v-ans').fill(wrong);
  await page.getByRole('button', { name: 'Submit for verification' }).click();
  await expect(page.getByText('The same gap showed up again')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The gap is still open' })).toBeVisible();
  await expect(node(page, 'turns_ratio')).not.toHaveClass(/st-MASTERED/);
});

test('a careless slip is handled differently: no probe, no mastery change', async ({ page }) => {
  await startDemo(page);
  await page.getByLabel('Final answer').fill('2.1 A');
  await page.getByLabel(/Working steps/).fill('V2 = 240/10 = 24 V');
  await page.getByRole('button', { name: 'Submit attempt' }).click();
  const stage = page.locator('#stage');
  await expect(stage.getByText('Careless slip')).toBeVisible();
  await expect(stage.getByText('Your mastery estimates were not changed')).toBeVisible();
  await expect(stage.getByRole('button', { name: 'Start recovery' })).toHaveCount(0);
  await expect(stage.getByRole('button', { name: 'Submit probe answer' })).toHaveCount(0);
  const changed = await page.evaluate(() => MT.ui.store.events().filter((e) => e.type === 'OBSERVATION').length);
  expect(changed).toBe(0);
  await stage.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByLabel('Final answer')).toHaveValue('2.1 A');
});

test('unreadable answers are rejected inline without starting a session', async ({ page }) => {
  await startDemo(page);
  await page.getByLabel('Final answer').fill('two amps');
  await page.getByRole('button', { name: 'Submit attempt' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Enter a number' })).toBeVisible();
  expect(await page.evaluate(() => MT.ui.store.sessionList().length)).toBe(0);
});
