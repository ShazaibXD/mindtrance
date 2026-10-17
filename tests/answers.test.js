const test = require('node:test');
const assert = require('node:assert/strict');
const MT = require('./load.js');

const orig = (trackId, problemId) => MT.data.instantiate(MT.data.problem(trackId, problemId), 1);

test('worked answers of the original problems', () => {
  assert.equal(orig('eee-transformers', 'tx-secondary-current').answer.value, 240 / 10 / 12);
  assert.equal(orig('eee-transformers', 'tx-kv-primary').answer.value, 2400 / 20 / 6);
  assert.equal(orig('jee-pulley', 'pulley-acceleration').answer.value, (2 * 10) / (2 + 4 / 2));
  assert.equal(orig('jee-ph-dilute', 'ph-dilute-hcl').answer.value, 6.98);
  assert.equal(orig('neet-hardy-weinberg', 'hw-carriers').answer.value, 0.32);
  assert.equal(orig('gate-subnet', 'subnet-hosts-26').answer.value, 62);
  assert.equal(orig('cse-twos-complement', 'twos-minus-13').answer.value, 11110011);
  assert.ok(MT.expr.exprEquivalent(orig('jee-chain-rule', 'chain-sin').answer.expr, '6*x*cos(3*x^2+1)'));
});

test('verification answers are computed from first principles', () => {
  for (const seed of [1, 5, 9, 31, 77]) {
    const sub = MT.data.instantiate(MT.data.track('gate-subnet').verification[0], seed);
    const p = Number(/\/(\d+)/.exec(sub.statement)[1]);
    assert.equal(sub.answer.value, Math.pow(2, 32 - p) - 2);

    const pul = MT.data.instantiate(MT.data.track('jee-pulley').verification[0], seed);
    const m = Number(/A (\d+) kg bucket/.exec(pul.statement)[1]);
    const M = Number(/mass (\d+) kg and radius/.exec(pul.statement)[1]);
    assert.ok(Math.abs(pul.answer.value - (10 * m) / (m + M / 2)) / pul.answer.value < 0.005);

    const tx = MT.data.instantiate(MT.data.track('eee-transformers').verification[0], seed);
    const r = Number(/N_1:N_2 = (\d+):1/.exec(tx.statement)[1]);
    const V1 = Number(/V_1 = ([\d.]+) V/.exec(tx.statement)[1]);
    const RL = Number(/R_L = ([\d.]+)/.exec(tx.statement)[1]);
    assert.ok(Math.abs(tx.answer.value - V1 / r / RL) < 1e-6);
  }
});

test('instantiate drops signatures that coincide with the correct answer', () => {
  const def = { id: 'x', title: 't', gen: () => ({ statement: 's', answer: { kind: 'number', value: 5, unit: '', tolPct: 1 }, solution: ['a'], patterns: [{ value: 5.01, cat: 'POSSIBLE_CARELESS_SLIP', evidence: 'e' }, { value: 9, cat: 'POSSIBLE_CARELESS_SLIP', evidence: 'e' }] }) };
  assert.deepEqual(MT.data.instantiate(def, 1).patterns.map((p) => p.value), [9]);
});

test('two\'s complement verification answers are recomputed from the statement', () => {
  const t = MT.data.track('cse-twos-complement');
  for (const seed of [1, 2, 3, 8, 21, 55]) {
    const neg = MT.data.instantiate(t.verification[0], seed);
    const n = Number(/value -(\d+)\?/.exec(neg.statement)[1]);
    assert.equal(parseInt(String(neg.answer.value), 2), 256 - n);
    const sub = MT.data.instantiate(t.verification[1], seed);
    const m = /computes (\d+) - (\d+)\./.exec(sub.statement);
    assert.equal(parseInt(String(sub.answer.value), 2), 256 + Number(m[1]) - Number(m[2]));
  }
});
