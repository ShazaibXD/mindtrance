const { test, expect } = require('@playwright/test');

test('a save from an earlier version opens every page that shows outcomes, with no error page', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(() => {
    if (localStorage.getItem('mindtrace.v1')) return;
    localStorage.setItem('mindtrace.v1', JSON.stringify({ v: 1, active: 'p1', profiles: { p1: { id: 'p1', name: 'Returning student', createdAt: 1, demo: false, data: {
      settings: { theme: 'dark' }, mastery: { 'eee-transformers:turns_ratio': { p: 0.3, obs: 2, fails: 1, learned: 0, updatedAt: 1 } }, seq: 5,
      events: [
        { id: 'e1', at: 1, type: 'ATTEMPT', trackId: 'eee-transformers', problemId: 'tx-secondary-current', sessionId: 's1', category: 'CARELESS_SLIP', correct: false },
        { id: 'e2', at: 2, type: 'ATTEMPT', trackId: 'eee-transformers', problemId: 'tx-secondary-current', sessionId: 's1', category: 'CONCEPT_MISCONCEPTION', correct: false, conceptId: 'turns_ratio' },
      ],
      sessions: { s1: { id: 's1', trackId: 'eee-transformers', problemId: 'tx-secondary-current', seed: 1, state: 'RETRY_REQUIRED', attemptCount: 1, history: [], probes: [], probeIndex: 0, log: [], createdAt: 1, updatedAt: 1,
        attempt: { answer: '2.1 A', working: '', at: 1 }, diagnosis: { engine: 'rule-based', category: 'CARELESS_SLIP', confidence: 0.6, evidence: ['The answer is within a few percent of the verified result.'], candidates: [], hintConcept: null, matchedBy: 'generic' } } },
    } } } }));
  });
  await page.goto('/#/app/dashboard');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Returning student');
  await page.goto('/#/app/workspace?session=s1');
  await expect(page.locator('#stage').getByRole('heading', { name: 'Diagnosis' })).toBeVisible();
  await expect(page.locator('#stage').getByText('Possible slip').first()).toBeVisible();
  await page.goto('/#/app/progress');
  await expect(page.getByText('Attempts and correctness')).toBeVisible();
  await expect(page.getByText('Repeated misconceptions')).toBeVisible();
  await page.goto('/#/app/map?track=eee-transformers');
  await expect(page.locator('.gv-node[data-id="turns_ratio"]')).toBeVisible();
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  expect(errs).toEqual([]);
});
