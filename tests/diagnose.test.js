const test = require('node:test');
const assert = require('node:assert/strict');
const MT = require('./load.js');

const first = (trackId, problemId) => {
  const track = MT.data.track(trackId);
  return { track, problem: MT.data.instantiate(MT.data.problem(trackId, problemId), 1) };
};
const text = (problem, pat) => (problem.answer.kind === 'expr' ? pat.expr : String(pat.value) + (problem.answer.unit ? ' ' + problem.answer.unit : ''));

test('correct answers are recognised for every original problem, including with units', () => {
  for (const track of MT.data.tracks) {
    for (const pr of track.problems) {
      const problem = MT.data.instantiate(pr, 1);
      const ans = problem.answer.kind === 'expr' ? problem.answer.expr : problem.answer.value + (problem.answer.unit ? ' ' + problem.answer.unit : '');
      assert.equal(MT.diagnose.classify(track, problem, ans, '').category, 'CORRECT', pr.id);
    }
  }
});

test('every known error signature classifies to its declared category and concept', () => {
  let n = 0;
  for (const track of MT.data.tracks) {
    const defs = [...track.problems, ...track.verification];
    for (const def of defs) {
      for (const seed of [1, 4, 17]) {
        const problem = MT.data.instantiate(def, seed);
        for (const pat of problem.patterns) {
          const expected = problem.patterns.find((q) => (problem.answer.kind === 'expr' ? MT.expr.exprEquivalent(q.expr, pat.expr) : MT.expr.close(pat.value, q.value, problem.answer)));
          const r = MT.diagnose.classify(track, problem, text(problem, pat), '');
          const wantCat = expected.concept === track.target && expected.cat === 'PREREQUISITE_GAP' ? 'CONCEPT_MISCONCEPTION' : expected.cat;
          assert.equal(r.category, wantCat, def.id + '@' + seed + ' ' + text(problem, pat));
          assert.equal(r.hintConcept, expected.concept);
          assert.equal(r.matchedBy, 'signature');
          n++;
        }
      }
    }
  }
  assert.ok(n > 100, 'checked ' + n);
});

test('hero problem: inverted ratio gives a turns_ratio suspect first, with evidence', () => {
  const { track, problem } = first('eee-transformers', 'tx-secondary-current');
  const d = MT.diagnose.diagnose(track, problem, '200 A', 'V2 = 240 x 10 = 2400 V, I2 = 2400/12', {});
  assert.equal(d.category, 'PREREQUISITE_GAP');
  assert.equal(d.candidates[0].id, 'turns_ratio');
  assert.ok(d.evidence.length >= 2, 'signature evidence plus agreeing working evidence');
  assert.ok(d.confidence > 0.85);
  assert.ok(d.candidates.length >= 2, 'other hypotheses are retained');
});

test('a slip is not blamed on a prerequisite and has no candidates', () => {
  const { track, problem } = first('eee-transformers', 'tx-secondary-current');
  const d = MT.diagnose.diagnose(track, problem, '2.1 A', 'V2 = 240/10 = 24 V; I2 = 24/12', {});
  assert.equal(d.category, 'CARELESS_SLIP');
  assert.deepEqual(d.candidates, []);
});

test('power-of-ten errors are unit errors on unit-sensitive problems and slips otherwise', () => {
  const kv = first('eee-transformers', 'tx-kv-primary');
  assert.equal(MT.diagnose.classify(kv.track, kv.problem, '0.2 A', '').category, 'UNIT_ERROR');
  assert.equal(MT.diagnose.classify(kv.track, kv.problem, '0.02 A', '').hintConcept, 'unit_conv');
  const tx = first('eee-transformers', 'tx-secondary-current');
  assert.equal(MT.diagnose.classify(tx.track, tx.problem, '0.2 A', '').category, 'CARELESS_SLIP');
});

test('the right number with a wrong unit dimension is a unit error', () => {
  const { track, problem } = first('eee-transformers', 'tx-secondary-current');
  const r = MT.diagnose.classify(track, problem, '2 V', '');
  assert.equal(r.category, 'UNIT_ERROR');
  assert.equal(MT.diagnose.classify(track, problem, '2000 mA', '').category, 'CORRECT');
});

test('sign flips and near misses are slips for inexact numeric problems', () => {
  const { track, problem } = first('jee-pulley', 'pulley-acceleration');
  assert.equal(MT.diagnose.classify(track, problem, '-5', '').category, 'CARELESS_SLIP');
  assert.equal(MT.diagnose.classify(track, problem, '5.2', '').category, 'CARELESS_SLIP');
});

test('exact problems do not treat near misses as slips', () => {
  const { track, problem } = first('gate-subnet', 'subnet-hosts-26');
  const r = MT.diagnose.classify(track, problem, '61', '');
  assert.notEqual(r.matchedBy, 'generic');
});

test('percentages and fractions are accepted where the problem allows them', () => {
  const { track, problem } = first('neet-hardy-weinberg', 'hw-carriers');
  for (const a of ['0.32', '32%', '32', '8/25']) assert.equal(MT.diagnose.classify(track, problem, a, '').category, 'CORRECT', a);
  assert.equal(MT.diagnose.classify(track, problem, '16%', '').hintConcept, 'hw_equation');
});

test('working steps alone can identify a gap when the number is unfamiliar', () => {
  const { track, problem } = first('jee-pulley', 'pulley-acceleration');
  const r = MT.diagnose.classify(track, problem, '4.1', 'I = M R^2 so I = 0.16 ... a = ...');
  assert.equal(r.matchedBy, 'working');
  assert.equal(r.hintConcept, 'moment_inertia');
});

test('an unrecognised answer is a low-confidence fallback ranked from the graph', () => {
  const { track, problem } = first('jee-pulley', 'pulley-acceleration');
  const mastery = { moment_inertia: 0.2 };
  const d = MT.diagnose.diagnose(track, problem, '17', 'no idea', mastery);
  assert.equal(d.matchedBy, 'fallback');
  assert.ok(d.confidence <= 0.35);
  assert.equal(d.candidates[0].id, 'moment_inertia', 'weak concept bubbles up');
});

test('invalid answers are rejected before diagnosis', () => {
  const { track, problem } = first('eee-transformers', 'tx-secondary-current');
  for (const bad of ['', 'two amps', '1/0']) assert.equal(MT.diagnose.classify(track, problem, bad, '').category, 'INVALID_INPUT');
  const m = first('jee-chain-rule', 'chain-sin');
  assert.equal(MT.diagnose.classify(m.track, m.problem, 'process.exit()', '').category, 'INVALID_INPUT');
});

test('concept ids in candidates are always valid graph nodes', () => {
  const { track, problem } = first('eee-transformers', 'tx-secondary-current');
  problem.patterns = [{ value: 200, cat: 'PREREQUISITE_GAP', concept: 'not_a_concept', evidence: 'x' }];
  const d = MT.diagnose.diagnose(track, problem, '200 A', '', {});
  assert.equal(d.hintConcept, null);
  const ids = new Set(track.concepts.map((c) => c.id));
  for (const c of d.candidates) assert.ok(ids.has(c.id));
});
