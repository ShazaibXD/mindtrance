const test = require('node:test');
const assert = require('node:assert/strict');
const MT = require('./load.js');

const legacySave = () => JSON.stringify({ v: 1, active: 'p1', profiles: { p1: { id: 'p1', name: 'Old', createdAt: 1, demo: false, data: {
  settings: { theme: 'dark', showHints: true }, mastery: {}, seq: 5,
  events: [
    { id: 'e1', at: 1, type: 'ATTEMPT', trackId: 'eee-transformers', category: 'CARELESS_SLIP', correct: false },
    { id: 'e2', at: 2, type: 'ATTEMPT', trackId: 'eee-transformers', category: 'UNIT_ERROR', correct: false, conceptId: 'unit_conv' },
    { id: 'e3', at: 3, type: 'ATTEMPT', trackId: 'eee-transformers', category: 'CONCEPT_MISCONCEPTION', correct: false, conceptId: 'turns_ratio' },
    { id: 'e4', at: 4, type: 'ATTEMPT', trackId: 'eee-transformers', category: 'CORRECT', correct: true },
  ],
  sessions: { s1: { id: 's1', trackId: 'eee-transformers', problemId: 'tx-secondary-current', seed: 1, state: 'RETRY_REQUIRED', attemptCount: 1, history: [{ attempt: {}, category: 'CONCEPT_MISCONCEPTION' }], probes: [], probeIndex: 0, log: [], createdAt: 1, updatedAt: 1,
    attempt: { answer: '2.1 A', working: '', at: 1 }, diagnosis: { engine: 'rule-based', category: 'CARELESS_SLIP', confidence: 0.6, evidence: ['x'], candidates: [], hintConcept: null, matchedBy: 'generic' } } },
} } } });

const load = () => { const m = new Map([['mindtrace.v1', legacySave()]]); return MT.store.create({ storage: { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) } }); };

test('saves from before the outcome taxonomy are migrated once, everywhere outcomes are stored', () => {
  const store = load();
  assert.deepEqual(store.events().map((e) => e.category), ['POSSIBLE_CARELESS_SLIP', 'CALCULATION_OR_UNIT_ERROR', 'CONCEPTUAL_GAP', 'CORRECT_UNDERSTANDING']);
  const s = store.getSession('s1');
  assert.equal(s.diagnosis.category, 'POSSIBLE_CARELESS_SLIP');
  assert.equal(s.history[0].category, 'CONCEPTUAL_GAP');
  assert.equal(store.data().schema, 2);
  for (const e of store.events()) assert.ok(MT.diagnose.OUTCOMES[e.category], e.category);
});

test('a migrated session works with the current flow', () => {
  const store = load();
  const s = store.getSession('s1');
  assert.equal(s.state, 'RETRY_REQUIRED');
  MT.flow.tryAgain(store, 's1');
  assert.equal(s.state, 'READY');
  const r = MT.flow.submitAttempt(store, 's1', '200 A', 'V2 = V1 x N1/N2 = 240 x 10');
  assert.ok(r.ok);
  assert.equal(s.state, 'GAP_CONFIRMED');
});

test('analytics understand migrated history', () => {
  const store = load();
  const rows = MT.analytics.repeatedMisconceptions(store.events());
  assert.ok(rows.some((r) => r.conceptId === 'turns_ratio' && r.category === 'CONCEPTUAL_GAP'));
  assert.equal(MT.analytics.attemptSeries(store.events()).filter((a) => a.correct).length, 1);
});

test('an unknown outcome name can never throw in a lookup', () => {
  assert.equal(MT.diagnose.outcomeMeta('CARELESS_SLIP').label, 'Possible slip');
  const unknown = MT.diagnose.outcomeMeta('SOMETHING_NEW_FROM_A_FUTURE_VERSION');
  assert.equal(unknown.kind, 'other');
  assert.match(unknown.label, /something new/);
  assert.equal(MT.diagnose.outcomeMeta(undefined).kind, 'other');
  assert.equal(MT.diagnose.kindOf('NOPE'), 'other');
});
