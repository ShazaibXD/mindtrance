const { test, expect } = require('@playwright/test');
const { startDemo } = require('./helpers');

const TRACKS = [
  ['eee-transformers', 'tx-secondary-current', '200 A', 'Turns, voltage and current ratios'],
  ['jee-pulley', 'pulley-acceleration', '10 m/s^2', 'Free-body diagrams and tension'],
  ['jee-ph-dilute', 'ph-dilute-hcl', '8', 'Total [H+] with water ionization'],
  ['jee-chain-rule', 'chain-sin', 'cos(3x^2+1)', 'Chain rule'],
  ['neet-hardy-weinberg', 'hw-carriers', '0.2', 'Allele vs genotype frequency'],
  ['gate-subnet', 'subnet-hosts-26', '64', 'Network and broadcast addresses'],
  ['cse-twos-complement', 'twos-minus-13', '11110010', 'Binary addition with carry'],
];

for (const [track, problem, wrong, hypothesis] of TRACKS) {
  test('track ' + track + ': a typical wrong answer leads to the expected hypothesis and probe', async ({ page }) => {
    await startDemo(page);
    await page.goto('/#/app/workspace?track=' + track + '&problem=' + problem);
    await page.getByLabel('Final answer').fill(wrong);
    await page.getByRole('button', { name: 'Submit attempt' }).click();
    const stage = page.locator('#stage');
    await expect(stage.getByRole('heading', { name: 'Diagnosis' })).toBeVisible();
    await expect(stage.getByText('Hypothesis: ' + hypothesis, { exact: false })).toBeVisible();
    await expect(stage.getByRole('button', { name: 'Submit probe answer' })).toBeVisible();
    await expect(stage).not.toContainText('Worked solution');
  });

  test('track ' + track + ': the correct answer is accepted', async ({ page }) => {
    await startDemo(page);
    await page.goto('/#/app/workspace?track=' + track + '&problem=' + problem);
    const right = await page.evaluate(([t, p]) => {
      const def = MT.data.problem(t, p);
      const pr = MT.data.instantiate(def, 1);
      return pr.answer.kind === 'expr' ? pr.answer.expr : String(pr.answer.value) + (pr.answer.unit ? ' ' + pr.answer.unit : '');
    }, [track, problem]);
    await page.getByLabel('Final answer').fill(right);
    await page.getByRole('button', { name: 'Submit attempt' }).click();
    await expect(page.getByRole('heading', { name: 'Correct' })).toBeVisible();
    await expect(page.getByText('Worked solution')).toBeVisible();
  });
}
