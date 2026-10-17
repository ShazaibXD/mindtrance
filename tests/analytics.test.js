const test = require('node:test');
const assert = require('node:assert/strict');
const MT = require('./load.js');
const A = MT.analytics;

const ev = (type, o) => Object.assign({ type, at: 1, trackId: 't', conceptId: 'c' }, o);

test('mastery over time averages every concept touched so far', () => {
  const pts = A.masteryOverTime([
    ev('OBSERVATION', { at: 1, conceptId: 'a', after: 0.2 }),
    ev('OBSERVATION', { at: 2, conceptId: 'b', after: 0.6 }),
    ev('LEARNING', { at: 3, conceptId: 'a', after: 0.4 }),
    ev('ATTEMPT', { at: 4 }),
  ]);
  assert.deepEqual(pts.map((p) => +p.mean.toFixed(2)), [0.2, 0.4, 0.5]);
  assert.deepEqual(pts.map((p) => p.touched), [1, 2, 2]);
  assert.deepEqual(A.masteryOverTime([]), []);
});

test('correctness trend uses a sliding window', () => {
  const att = [true, true, false, false, false, true].map((c) => ({ correct: c }));
  const t = A.correctnessTrend(att, 3);
  assert.equal(t[0].rate, 1);
  assert.equal(t[4].rate, 0);
  assert.ok(Math.abs(t[5].rate - 1 / 3) < 1e-9);
});

test('recovery stats and success rate', () => {
  const s = A.recoveryStats([ev('RECOVERY_STARTED'), ev('RECOVERY_STARTED'), ev('MASTERY_VERIFIED'), ev('VERIFICATION_FAILED')]);
  assert.deepEqual(s, { started: 2, verified: 1, failed: 1, rate: 0.5 });
  assert.equal(A.recoveryStats([]).rate, null);
});

test('repeated misconceptions group by concept and category, most frequent first', () => {
  const rows = A.repeatedMisconceptions([
    ev('ATTEMPT', { category: 'PREREQUISITE_GAP', conceptId: 'x', correct: false, at: 1 }),
    ev('ATTEMPT', { category: 'PREREQUISITE_GAP', conceptId: 'y', correct: false, at: 2 }),
    ev('ATTEMPT', { category: 'PREREQUISITE_GAP', conceptId: 'y', correct: false, at: 3 }),
    ev('ATTEMPT', { category: 'POSSIBLE_CARELESS_SLIP', conceptId: null, correct: false }),
    ev('ATTEMPT', { category: 'CORRECT_UNDERSTANDING', correct: true }),
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].conceptId, 'y');
  assert.equal(rows[0].count, 2);
});

test('weakest lists only concepts with evidence, lowest first', () => {
  const m = new Map();
  const store = MT.store.create({ storage: { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) } });
  store.signUp('Tess');
  assert.deepEqual(A.weakest(store), []);
  store.observe('eee-transformers', 'ohms_law', true, {});
  store.observe('eee-transformers', 'turns_ratio', false, {});
  const w = A.weakest(store);
  assert.equal(w[0].concept.id, 'turns_ratio');
  assert.equal(w.length, 2);
});

test('recently mastered returns newest first', () => {
  const r = A.recentlyMastered([ev('MASTERY_VERIFIED', { at: 1 }), ev('MASTERY_VERIFIED', { at: 2 }), ev('OBSERVATION', { at: 3 })], 5);
  assert.deepEqual(r.map((e) => e.at), [2, 1]);
});
