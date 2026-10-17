const { expect } = require('@playwright/test');

/* Opens the landing page and enters the judge demo. */
async function startDemo(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Judge demo', exact: true }).click();
  await expect(page).toHaveURL(/#\/app\/workspace/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Secondary current');
}

async function submitDemoAttempt(page) {
  await page.getByRole('button', { name: 'Fill in the demo wrong attempt' }).click();
  await expect(page.getByLabel('Final answer')).toHaveValue('200 A');
  await page.getByRole('button', { name: 'Submit attempt' }).click();
  await expect(page.getByRole('heading', { name: 'Diagnosis' })).toBeVisible();
}

/* Fails the first probe on purpose (1000 V is what an inverted ratio gives). */
async function failProbe(page) {
  await page.getByLabel('1000 V').check();
  await page.getByRole('button', { name: 'Submit probe answer' }).click();
  await expect(page.getByRole('heading', { name: 'Gap confirmed' })).toBeVisible();
}

async function recoverToVerification(page) {
  await page.getByRole('button', { name: 'Start recovery' }).click();
  await expect(page.getByRole('heading', { name: /^Recover: Turns/ })).toBeVisible();
  await page.getByRole('button', { name: /I have read this/ }).click();
  await page.getByLabel('100 V', { exact: true }).check();
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.getByText('Correct.', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Go to verification' }).click();
  await expect(page.getByRole('heading', { name: 'Fresh verification problem' })).toBeVisible();
}

/* The verification answer is read from the app state: the test cannot guess generated numbers. */
async function solveVerification(page) {
  for (let i = 0; i < 4; i++) {
    const answer = await page.evaluate(() => {
      const id = new URLSearchParams(location.hash.split('?')[1]).get('session');
      return MT.flow.verificationProblem(MT.ui.store.getSession(id)).answer.display;
    });
    await page.locator('#v-ans').fill(answer);
    await page.getByRole('button', { name: 'Submit for verification' }).click();
    await expect(page.getByRole('heading', { name: /Mastery verified|Fresh verification problem/ })).toBeVisible();
    if (await page.getByRole('heading', { name: 'Mastery verified' }).isVisible()) return;
  }
  throw new Error('verification did not complete');
}

const node = (page, id) => page.locator('.gv-node[data-id="' + id + '"]');

module.exports = { startDemo, submitDemoAttempt, failProbe, recoverToVerification, solveVerification, node };
