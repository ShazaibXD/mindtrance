const test = require('node:test');
const assert = require('node:assert/strict');
const MT = require('./load.js');

const SEEDS = [1, 2, 3, 7, 42, 99, 1234, 98765];

function checkProblemShape(p, label) {
  assert.ok(p.statement && p.statement.length > 20, label + ' statement');
  assert.ok(p.answer && (p.answer.kind === 'number' || p.answer.kind === 'expr'), label + ' answer kind');
  assert.ok(Array.isArray(p.solution) && p.solution.length >= 1, label + ' solution');
  const pats = p.patterns || [];
  for (const pat of pats) {
    assert.ok(['CARELESS_SLIP', 'UNIT_ERROR', 'PREREQUISITE_GAP', 'CONCEPT_MISCONCEPTION'].includes(pat.cat), label + ' pattern cat');
    assert.ok(pat.evidence, label + ' pattern evidence');
    if (p.answer.kind === 'number') {
      assert.ok(Number.isFinite(pat.value), label + ' pattern value');
      assert.ok(!MT.expr.close(pat.value, p.answer.value, p.answer), label + ' pattern equals the correct answer: ' + pat.value);
    } else {
      assert.ok(MT.expr.exprParses(pat.expr), label + ' pattern expr parses: ' + pat.expr);
      assert.ok(!MT.expr.exprEquivalent(pat.expr, p.answer.expr), label + ' pattern equals the answer: ' + pat.expr);
    }
  }
  if (p.answer.kind === 'expr') assert.ok(MT.expr.exprParses(p.answer.expr), label + ' answer expr parses');
}

test('at least one track is registered and ids are unique', () => {
  const ids = MT.data.tracks.map((t) => t.id);
  assert.ok(ids.length >= 1);
  assert.equal(new Set(ids).size, ids.length);
});

for (const track of MT.data.tracks) {
  test(track.id + ': knowledge graph is valid', () => {
    assert.deepEqual(MT.graph.validate(track), []);
  });

  test(track.id + ': learning content is complete', () => {
    const ids = new Set(track.concepts.map((c) => c.id));
    for (const c of track.concepts) {
      assert.ok(c.name && c.desc, c.id + ' name/desc');
      const l = c.lesson;
      assert.ok(l.explain && l.why && l.misconception && l.example.q && l.example.a, c.id + ' lesson');
      for (const key of ['probe', 'practice']) {
        const q = c[key];
        assert.ok(q.q && q.options.length === 3, c.id + ' ' + key + ' options');
        assert.ok(Number.isInteger(q.correct) && q.correct >= 0 && q.correct < 3, c.id + ' ' + key + ' correct index');
        assert.equal(new Set(q.options).size, 3, c.id + ' ' + key + ' options distinct');
      }
      assert.ok(c.practice.feedback, c.id + ' practice feedback');
    }
    assert.ok(ids.has(track.target));
  });

  test(track.id + ': problems and error patterns are well formed', () => {
    assert.ok(track.problems.length >= 1);
    const ids = new Set(track.concepts.map((c) => c.id));
    for (const pr of track.problems) {
      assert.ok(ids.has(pr.target), pr.id + ' target concept');
      const p = MT.data.instantiate(pr, 1);
      checkProblemShape(p, pr.id);
      for (const pat of p.patterns) if (pat.concept) assert.ok(ids.has(pat.concept), pr.id + ' pattern concept ' + pat.concept);
      for (const k of p.keywords || []) if (k.concept) assert.ok(ids.has(k.concept), pr.id + ' keyword concept');
    }
  });

  test(track.id + ': verification templates generate valid fresh problems for many seeds', () => {
    assert.ok(track.verification.length >= 2, 'needs at least two verification templates');
    const ids = new Set(track.concepts.map((c) => c.id));
    for (const v of track.verification) {
      const stmts = new Set();
      for (const s of SEEDS) {
        const p = MT.data.instantiate(v, s);
        checkProblemShape(p, v.id + '@' + s);
        for (const pat of p.patterns) if (pat.concept) assert.ok(ids.has(pat.concept), v.id + ' pattern concept');
        stmts.add(p.statement);
      }
      assert.ok(stmts.size > 1, v.id + ' should vary with the seed');
    }
    // fresh means different from every original problem
    const originals = track.problems.map((pr) => MT.data.instantiate(pr, 1).statement);
    for (const v of track.verification) assert.ok(!originals.includes(MT.data.instantiate(v, 1).statement));
  });
}
