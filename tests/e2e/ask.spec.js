const { test, expect } = require('@playwright/test');
const { startDemo } = require('./helpers');

const STRONG = 'The treaty demanded reparations that wrecked the economy, which fed resentment that Hitler and the Nazis exploited.';
const WEAK = 'The treaty was unfair to Germany.';

async function openFixture(page) {
  await startDemo(page);
  await page.getByRole('link', { name: 'Ask anything' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Start from any question');
  await page.getByRole('button', { name: 'Open the demo question' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Treaty of Versailles');
}

const sessionAnswer = (page) => page.evaluate(() => {
  const id = new URLSearchParams(location.hash.split('?')[1]).get('session');
  return MT.flow.verificationProblem(MT.ui.store.getSession(id)).answer.display;
});

test('without a key the page explains what is needed and offers the labelled demo', async ({ page }) => {
  await startDemo(page);
  await page.getByRole('link', { name: 'Ask anything' }).click();
  await expect(page.getByText('needs a Gemini key')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Build my learning map' })).toBeDisabled();
  await expect(page.getByText('demo fixture').first()).toBeVisible();
  await expect(page.getByText('not AI').first()).toBeVisible();
});

test('universal loop on the demo question: weak answer, follow-up, recovery, fresh question, verified, retry', async ({ page }) => {
  await openFixture(page);

  // open-ended answer, labelled rubric (not AI), uncertain so it asks a follow-up
  await page.getByLabel('Your answer').fill(WEAK);
  await page.getByRole('button', { name: 'Submit attempt' }).click();
  const stage = page.locator('#stage');
  await expect(stage.getByRole('heading', { name: 'Diagnosis' })).toBeVisible();
  await expect(stage.getByText('Demo rubric: scripted keyword rules, not AI')).toBeVisible();
  await expect(stage.getByText('Not sure yet')).toBeVisible();
  await expect(stage.getByRole('heading', { name: /^Follow-up question/ })).toBeVisible();
  await expect(stage.getByText('Hypothesis: Terms of the Treaty')).toBeVisible();

  // fail the follow-up on purpose
  const wrongLabel = await page.evaluate(() => {
    const id = new URLSearchParams(location.hash.split('?')[1]).get('session');
    const s = MT.ui.store.getSession(id);
    const pr = MT.flow.currentProbe(s);
    return pr.mcq.options.find((o) => o.index !== pr.concept.probe.correct).text;
  });
  await page.getByLabel(wrongLabel, { exact: true }).check();
  await page.getByRole('button', { name: 'Submit probe answer' }).click();
  await expect(page.getByRole('heading', { name: 'Gap confirmed' })).toBeVisible();
  await expect(page.locator('.gv-node[data-id="ww1_settlement"]')).toHaveClass(/st-CONFIRMED_GAP/);
  await expect(page.locator('.gv-node[data-id="versailles_wwii"]')).toHaveClass(/st-BLOCKED/);

  // recovery, then a fresh multiple-choice question that tests the same concept
  await page.getByRole('button', { name: 'Start recovery' }).click();
  await expect(page.getByRole('heading', { name: /^Recover: Terms of the Treaty/ })).toBeVisible();
  await page.getByRole('button', { name: /I have read this/ }).click();
  const right = await page.evaluate(() => {
    const id = new URLSearchParams(location.hash.split('?')[1]).get('session');
    const pr = MT.flow.currentPractice(MT.ui.store.getSession(id));
    return pr.mcq.options.find((o) => o.index === pr.concept.practice.correct).text;
  });
  await page.getByLabel(right, { exact: true }).check();
  await page.getByRole('button', { name: 'Check answer' }).click();
  await page.getByRole('button', { name: 'Go to verification' }).click();
  await expect(page.getByRole('heading', { name: 'Fresh verification problem' })).toBeVisible();
  const fresh = await page.locator('form[data-form=verify] .problem-text').innerText();
  expect(fresh).not.toContain('Treaty of Versailles contributed');
  for (let i = 0; i < 3; i++) {
    await page.getByLabel(await sessionAnswer(page), { exact: true }).check();
    await page.getByRole('button', { name: 'Submit for verification' }).click();
    await expect(page.getByRole('heading', { name: /Mastery verified|Fresh verification problem/ })).toBeVisible();
    if (await page.getByRole('heading', { name: 'Mastery verified' }).isVisible()) break;
  }
  await expect(page.getByRole('heading', { name: 'Mastery verified' })).toBeVisible();
  await expect(page.locator('.gv-node[data-id="ww1_settlement"]')).toHaveClass(/st-MASTERED/);

  // retry with a strong answer: accepted, but labelled as a judgement
  await page.getByRole('button', { name: 'Retry the original problem' }).click();
  await page.getByLabel('Your answer').fill(STRONG);
  await page.getByRole('button', { name: 'Submit attempt' }).click();
  await expect(page.getByRole('heading', { name: 'Correct' })).toBeVisible();
  await expect(page.getByText('AI-judged')).toBeVisible();
  await expect(page.getByText('not a deterministically verified result')).toBeVisible();

  // persistence and cleanup
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Correct' })).toBeVisible();
  await page.getByRole('link', { name: 'Ask anything' }).click();
  await expect(page.getByText('demo fixture').nth(1)).toBeVisible();
  await page.getByRole('button', { name: 'Delete this question' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('Nothing yet.')).toBeVisible();
});

test('a very short or vague answer gets the lowest-confidence follow-up, never a confident diagnosis', async ({ page }) => {
  await openFixture(page);
  await page.getByLabel('Your answer').fill('It was bad.');
  await page.getByRole('button', { name: 'Submit attempt' }).click();
  await expect(page.locator('#stage').getByText('Not sure yet')).toBeVisible();
  await expect(page.locator('#stage').getByText(/2\d%/).first()).toBeVisible();
});

test.describe('with a Gemini key (Google endpoint mocked)', () => {
  async function mockGoogle(page, { onGenerate, onJudge }) {
    const calls = { generate: 0, judge: 0, headers: [], urls: [] };
    await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
      const req = route.request();
      calls.urls.push(req.url());
      calls.headers.push(req.headers()['x-goog-api-key']);
      const body = JSON.parse(req.postData());
      const isGenerate = !!body.generationConfig.responseSchema.properties.nodes;
      if (isGenerate) { calls.generate++; const r = await onGenerate(); if (r.status) return route.fulfill({ status: r.status, body: '{}' }); return route.fulfill({ json: { candidates: [{ content: { parts: [{ text: JSON.stringify(r.json) }] } }] } }); }
      calls.judge++;
      return route.fulfill({ json: { candidates: [{ content: { parts: [{ text: JSON.stringify(await onJudge(body)) }] } }] } });
    });
    return calls;
  }

  async function addKey(page) {
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByLabel('Gemini API key').fill('TEST-KEY-NOT-REAL');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Gemini settings saved.')).toBeVisible();
  }

  test('builds a map from a typed question, judges the answer, and sends the key only in a header', async ({ page }) => {
    await startDemo(page);
    const spec = await page.evaluate(() => MT.custom.FIXTURE.spec);
    const calls = await mockGoogle(page, {
      onGenerate: async () => ({ json: spec }),
      onJudge: async () => ({ is_correct: false, category: 'PREREQUISITE_GAP', confidence: 0.45, suspected_concept_id: 'reparations', evidence_from_student_work: 'The answer never links payments to the economy.' }),
    });
    await addKey(page);
    await page.getByRole('link', { name: 'Ask anything' }).click();
    await page.getByRole('button', { name: 'Build my learning map' }).click(); // empty question is rejected before any request
    await expect(page.getByRole('alert').filter({ hasText: 'short sentence' })).toBeVisible();
    expect(calls.generate).toBe(0);
    await page.getByLabel('What do you want to understand or answer?').fill('Why did the Treaty of Versailles help cause a second world war?');
    await page.getByRole('button', { name: 'Build my learning map' }).click();
    await expect(page).toHaveURL(/workspace\?track=ask-/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Treaty of Versailles');
    expect(calls.generate).toBe(1);

    await page.getByLabel('Your answer').fill('Germany was punished and had to pay a lot.');
    await page.getByRole('button', { name: 'Submit attempt' }).click();
    const stage = page.locator('#stage');
    await expect(stage.getByRole('heading', { name: 'Diagnosis' })).toBeVisible();
    await expect(stage.getByText('Gemini reading, schema-validated')).toBeVisible();
    await expect(stage.getByText('never links payments to the economy')).toBeVisible();
    await expect(stage.getByText('Not sure yet')).toBeVisible();
    await expect(stage.getByText('Hypothesis: Reparations and the economy')).toBeVisible();
    expect(calls.judge).toBe(1);
    expect(calls.headers.every((h) => h === 'TEST-KEY-NOT-REAL')).toBe(true);
    expect(calls.urls.every((u) => !u.includes('TEST-KEY-NOT-REAL'))).toBe(true);
    const src = await page.evaluate(() => MT.ui.store.customTracks()[0].source);
    expect(src).toBe('gemini');
  });

  test('a rate-limited or malformed generation is reported and nothing is saved', async ({ page }) => {
    await startDemo(page);
    const spec = await page.evaluate(() => MT.custom.FIXTURE.spec);
    let mode = 429;
    await mockGoogle(page, {
      onGenerate: async () => (mode === 429 ? { status: 429 } : { json: Object.assign({}, spec, { nodes: spec.nodes.slice(0, 2) }) }),
      onJudge: async () => ({}),
    });
    await addKey(page);
    await page.getByRole('link', { name: 'Ask anything' }).click();
    const q = page.getByLabel('What do you want to understand or answer?');
    await q.fill('Why did the Roman Republic collapse into an empire?');
    await page.getByRole('button', { name: 'Build my learning map' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'rate limiting' })).toBeVisible();
    mode = 200;
    await page.getByRole('button', { name: 'Build my learning map' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'generated map was rejected' })).toBeVisible();
    expect(await page.evaluate(() => MT.ui.store.customTracks().length)).toBe(0);
  });

  test('a judgement naming a concept that is not in the map is rejected, not trusted', async ({ page }) => {
    await startDemo(page);
    const spec = await page.evaluate(() => MT.custom.FIXTURE.spec);
    await mockGoogle(page, {
      onGenerate: async () => ({ json: spec }),
      onJudge: async () => ({ is_correct: false, category: 'PREREQUISITE_GAP', confidence: 0.9, suspected_concept_id: 'invented_concept', evidence_from_student_work: 'x' }),
    });
    await addKey(page);
    await page.getByRole('link', { name: 'Ask anything' }).click();
    await page.getByLabel('What do you want to understand or answer?').fill('Explain how the treaty contributed to the second world war.');
    await page.getByRole('button', { name: 'Build my learning map' }).click();
    await expect(page).toHaveURL(/workspace\?track=ask-/);
    await page.getByLabel('Your answer').fill('Some answer that is long enough.');
    await page.getByRole('button', { name: 'Submit attempt' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'not in the knowledge graph' })).toBeVisible();
    expect(await page.evaluate(() => MT.ui.store.sessionList().length)).toBe(0);
  });
});
