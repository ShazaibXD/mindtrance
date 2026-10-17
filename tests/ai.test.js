const test = require('node:test');
const assert = require('node:assert/strict');
const MT = require('./load.js');

const track = MT.data.track('eee-transformers');
const problem = MT.data.instantiate(track.problems[0], 1);
const good = { category: 'PREREQUISITE_GAP', confidence: 0.7, suspected_concept_id: 'turns_ratio', evidence_from_student_work: 'Multiplied by N1/N2.' };
const reply = (obj, ok = true, status = 200) => async () => ({ ok, status, json: async () => ({ candidates: [{ content: { parts: [{ text: typeof obj === 'string' ? obj : JSON.stringify(obj) }] } }] }) });

test('valid output is accepted and normalised', () => {
  const r = MT.ai.validate(good, track);
  assert.ok(r.ok);
  assert.equal(r.value.hintConcept, 'turns_ratio');
  assert.equal(r.value.engine, 'gemini');
  assert.match(r.value.evidence[0], /AI reading/);
});

test('invalid output is rejected safely', () => {
  const bad = [
    'not json', '[]', null, { ...good, category: 'CORRECT' }, { ...good, confidence: 'high' }, { ...good, confidence: NaN },
    { ...good, suspected_concept_id: 'invented_concept' }, { ...good, suspected_concept_id: '' }, { ...good, evidence_from_student_work: '  ' },
  ];
  for (const b of bad) assert.equal(MT.ai.validate(b, track).ok, false, JSON.stringify(b));
});

test('confidence is clamped and misconception maps to the target concept', () => {
  const r = MT.ai.validate({ ...good, category: 'CONCEPT_MISCONCEPTION', confidence: 4 }, track);
  assert.equal(r.value.confidence, 1);
  assert.equal(r.value.hintConcept, track.target);
  const slip = MT.ai.validate({ ...good, category: 'CARELESS_SLIP', suspected_concept_id: '' }, track);
  assert.ok(slip.ok);
  assert.equal(slip.value.hintConcept, null);
});

test('classify sends the key as a header, never in the URL, and returns validated output', async () => {
  let seen;
  const fetch = async (url, init) => { seen = { url, init }; return reply(good)(); };
  const r = await MT.ai.classify({ apiKey: 'KEY123', fetch }, track, problem, '200 A', 'V2 = 240 x 10');
  assert.ok(r.ok);
  assert.ok(!seen.url.includes('KEY123'));
  assert.equal(seen.init.headers['x-goog-api-key'], 'KEY123');
  const body = JSON.parse(seen.init.body);
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.ok(body.contents[0].parts[0].text.includes('turns_ratio'));
});

test('failures give friendly messages that never contain the key', async () => {
  for (const status of [400, 429, 500]) {
    const r = await MT.ai.classify({ apiKey: 'KEY123', fetch: async () => ({ ok: false, status }) }, track, problem, '1', '');
    assert.equal(r.ok, false);
    assert.ok(!r.error.includes('KEY123'));
  }
  const net = await MT.ai.classify({ apiKey: 'KEY123', fetch: async () => { throw new Error('boom KEY123'); } }, track, problem, '1', '');
  assert.ok(!net.error.includes('KEY123'));
  assert.equal((await MT.ai.classify({ fetch: reply(good) }, track, problem, '1', '')).ok, false);
  assert.equal((await MT.ai.classify({ apiKey: 'k', fetch: reply('garbage') }, track, problem, '1', '')).ok, false);
});

test('timeouts abort the request', async () => {
  const fetch = (url, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('x'), { name: 'AbortError' }))));
  const r = await MT.ai.classify({ apiKey: 'k', fetch, timeoutMs: 20 }, track, problem, '1', '');
  assert.match(r.error, /too long/);
});

test('AI override is applied only to unclassified answers and cannot declare correctness', () => {
  const store = MT.store.create({ storage: { getItem: () => null, setItem() {}, removeItem() {} } });
  store.signUp('Tess');
  const s = MT.flow.startSession(store, 'eee-transformers', 'tx-secondary-current');
  const ov = MT.ai.validate({ ...good, suspected_concept_id: 'unit_conv' }, track).value;
  // A known signature is not overridden.
  const r1 = MT.flow.submitAttempt(store, s.id, '200 A', '', { override: ov });
  assert.equal(r1.diagnosis.engine, 'rule-based');
  assert.equal(r1.diagnosis.hintConcept, 'turns_ratio');
  // An unrecognised answer is.
  const s2 = store.newSession({ trackId: 'eee-transformers', problemId: 'tx-secondary-current', seed: 1, attemptCount: 0, history: [] });
  const r2 = MT.flow.submitAttempt(store, s2.id, '7.7 A', 'no idea', { override: ov });
  assert.equal(r2.diagnosis.engine, 'gemini');
  assert.equal(r2.diagnosis.candidates[0].id, 'unit_conv');
  // A correct answer is never overridden.
  const s3 = store.newSession({ trackId: 'eee-transformers', problemId: 'tx-secondary-current', seed: 1, attemptCount: 0, history: [] });
  assert.equal(MT.flow.submitAttempt(store, s3.id, '2 A', '', { override: ov }).diagnosis.category, 'CORRECT');
});
