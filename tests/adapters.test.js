const test = require('node:test');
const assert = require('node:assert/strict');
const MT = require('./load.js');
const A = MT.adapters;

test('the nine subject adapters from the spec exist with guidance, a probe style and a verification format', () => {
  assert.deepEqual(A.ADAPTERS.map((a) => a.id), ['math', 'physics', 'chemistry', 'biology', 'programming', 'language', 'humanities', 'commerce', 'writing']);
  for (const a of A.ADAPTERS) { assert.ok(a.guidelines && a.probe && a.verification && a.name, a.id); assert.ok(Array.isArray(a.verifiers)); }
});

test('adapters are honest about which deterministic verifiers exist in the browser', () => {
  const avail = (id) => A.ADAPTERS.find((a) => a.id === id).verifiers.filter((v) => v.available).length;
  assert.ok(avail('math') >= 1);
  assert.ok(avail('physics') >= 1);
  for (const id of ['chemistry', 'biology', 'programming', 'language', 'humanities', 'commerce', 'writing']) assert.equal(avail(id), 0, id + ' has no real verifier here');
  assert.match(A.ADAPTERS.find((a) => a.id === 'programming').verifiers[0].note, /never executed/);
});

test('adapters are chosen from subject words, with a general fallback', () => {
  assert.equal(A.forSubject('Basic Electrical Engineering', 'Single-phase transformers').id, 'physics');
  assert.equal(A.forSubject('Mathematics', 'Differentiation').id, 'math');
  assert.equal(A.forSubject('History', 'Versailles and the road to WWII').id, 'humanities');
  assert.equal(A.forSubject('Computer Networks', 'IP addressing').id, 'general');
  assert.equal(A.forSubject('Physical Chemistry', 'Ionic equilibrium').id, 'chemistry');
  assert.equal(A.forSubject('Essay question about argument structure').id, 'writing');
  assert.equal(A.forSubject().id, 'general');
});

test('mastery estimator: objective questions use BKT, open-ended and humanities work uses the rubric track', () => {
  const math = A.forSubject('math');
  assert.equal(A.estimatorFor(math, 'NUMERICAL_PROBLEM'), 'BKT_DISCRETE');
  assert.equal(A.estimatorFor(math, 'MULTIPLE_CHOICE'), 'BKT_DISCRETE');
  assert.equal(A.estimatorFor(math, 'PROOF_OR_DERIVATION'), 'RUBRIC_BETA');
  assert.equal(A.estimatorFor(A.forSubject('history'), 'NUMERICAL_PROBLEM'), 'RUBRIC_BETA', 'humanities is always rubric-based');
  assert.equal(A.estimatorFor(A.forSubject('physics'), 'CONCEPT_EXPLANATION'), 'RUBRIC_BETA');
});

test('recovery strategy follows the outcome kind', () => {
  assert.equal(A.recoveryStrategy('gap', A.forSubject('math')).blocks.length, 5);
  assert.ok(A.recoveryStrategy('procedural').blocks.join(' ').includes('corrected step'));
  assert.ok(A.recoveryStrategy('slip').blocks.join(' ').includes('re-submission'));
});

test('the prompt guidance covers every domain on one compact line each', () => {
  const g = A.promptGuidance();
  for (const a of A.ADAPTERS) assert.ok(g.includes(a.name + ':'), a.id);
});
