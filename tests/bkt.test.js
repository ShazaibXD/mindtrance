const test = require('node:test');
const assert = require('node:assert/strict');
const bkt = require('../js/core/bkt.js');

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, a + ' vs ' + b);

test('correct observation matches the closed form', () => {
  const r = bkt.observe(0.5, true);
  near(r.posterior, (0.5 * 0.9) / (0.5 * 0.9 + 0.5 * 0.2));
  assert.ok(r.after > 0.5);
});

test('incorrect observation lowers mastery and applies no learning', () => {
  const r = bkt.observe(0.55, false);
  near(r.posterior, (0.55 * 0.1) / (0.55 * 0.1 + 0.45 * 0.8));
  assert.ok(r.after < 0.55);
});

test('a failed answer can never raise mastery', () => {
  for (let p = 0.01; p < 0.99; p += 0.01) assert.ok(bkt.observe(p, false).after <= p + 1e-12);
});

test('learn applies the transition only when called', () => {
  near(bkt.learn(0.2), 0.2 + 0.8 * 0.25);
  const obs = bkt.observe(0.2, false);
  assert.ok(obs.after < 0.2, 'observing must not include P(T)');
});

test('recovery pipeline: gap, learn, practice, verify reaches mastered', () => {
  let p = bkt.observe(0.55, false).after;
  assert.equal(bkt.status(p), 'CONFIRMED_GAP');
  p = bkt.learn(p);
  p = bkt.observe(p, true).after;
  p = bkt.observe(p, true).after;
  assert.equal(bkt.status(p), 'MASTERED');
});

test('boundary probabilities stay finite and inside (0,1)', () => {
  for (const p of [0, 1, 1e-12, 1 - 1e-12]) {
    for (const c of [true, false]) {
      const r = bkt.observe(p, c);
      assert.ok(Number.isFinite(r.after) && r.after > 0 && r.after < 1);
    }
    const l = bkt.learn(p);
    assert.ok(Number.isFinite(l) && l > 0 && l < 1);
  }
});

test('numerical stability over many repeated observations', () => {
  let p = 0.5;
  for (let i = 0; i < 500; i++) p = bkt.observe(p, true).after;
  assert.ok(p < 1 && p > 0.99);
  for (let i = 0; i < 500; i++) p = bkt.observe(p, false).after;
  assert.ok(p > 0 && p < 0.01);
});

test('status thresholds', () => {
  assert.equal(bkt.status(0.80), 'MASTERED');
  assert.equal(bkt.status(0.7999), 'NEEDS_VERIFICATION');
  assert.equal(bkt.status(0.45), 'NEEDS_VERIFICATION');
  assert.equal(bkt.status(0.4499), 'CONFIRMED_GAP');
  assert.equal(bkt.status(0.6, { masteredAt: 0.55 }), 'MASTERED');
});

test('invalid parameters are rejected', () => {
  assert.throws(() => bkt.observe(0.5, true, { pSlip: 0 }), RangeError);
  assert.throws(() => bkt.observe(0.5, true, { pGuess: 1 }), RangeError);
  assert.throws(() => bkt.observe(0.5, true, { pSlip: 0.6, pGuess: 0.5 }), RangeError);
  assert.throws(() => bkt.observe(0.5, true, { pTransit: NaN }), RangeError);
  assert.throws(() => bkt.status(0.5, { gapBelow: 0.9, masteredAt: 0.8 }), RangeError);
  assert.throws(() => bkt.observe(NaN, true), RangeError);
});
