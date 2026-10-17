const test = require('node:test');
const assert = require('node:assert/strict');
const MT = require('./load.js');
const F = MT.flow;

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
let clock = 9_000_000;
const fresh = () => { const s = MT.store.create({ storage: mem(), now: () => (clock += 1000) }); s.signUp('Tess'); return s; };
const T = 'eee-transformers';
const P = 'tx-secondary-current';
const withFixture = () => { const store = fresh(); const id = store.addCustomTrack({ question: MT.custom.FIXTURE.question, spec: MT.custom.FIXTURE.spec, source: 'fixture' }); return { store, id }; };

test('the seven learning modes are defined, and only some need an attempt', () => {
  assert.deepEqual(F.MODES.map((m) => m.id), ['SOLVE_WITH_ME', 'CHECK_ANSWER', 'DIAGNOSE_MISTAKE', 'GIVE_HINT', 'EXPLAIN_CONCEPT', 'TEACH_FROM_BASICS', 'EXAM_PREP']);
  assert.deepEqual(F.MODES.filter((m) => !m.attempt).map((m) => m.id), ['GIVE_HINT', 'EXPLAIN_CONCEPT', 'TEACH_FROM_BASICS']);
});

test('hints escalate through three levels, give no answer, and change no mastery', () => {
  const store = fresh();
  const before = JSON.stringify(store.masteryMap(T));
  const h = [1, 2, 3, 9].map((l) => F.getHint(store, T, P, l));
  assert.deepEqual(h.map((x) => x.level), [1, 2, 3, 3]);
  assert.match(h[0].text, /^Think about:/);
  assert.match(h[1].text, /worked example/i);
  assert.match(h[2].text, /in short/);
  assert.equal(JSON.stringify(store.masteryMap(T)), before);
  assert.equal(store.events().filter((e) => e.type === 'HINT').length, 4);
  const answer = MT.data.instantiate(MT.data.problem(T, P), 1).answer.display;
  for (const x of h) assert.ok(!x.text.includes(answer + ' ') || answer.length < 3);
});

test('the hint points at the concept the evidence says is weakest', () => {
  const store = fresh();
  store.observe(T, 'alg_rearrange', false, {});
  const h = F.getHint(store, T, P, 1);
  assert.equal(h.concept.id, 'alg_rearrange');
});

test('explain mode skips questioning and offers an optional quick check', () => {
  const store = fresh();
  const s = F.startSession(store, T, P);
  const r = F.startExplanation(store, s.id, 'EXPLAIN_CONCEPT');
  assert.ok(r.ok);
  assert.equal(s.state, 'DIRECT_EXPLANATION');
  assert.deepEqual(s.explain.concepts, ['ideal_tx']);
  assert.equal(store.events().filter((e) => e.type === 'OBSERVATION').length, 0, 'explaining alone changes no estimate');
  const chk = F.currentExplainCheck(s);
  assert.equal(chk.concept.id, 'ideal_tx');
  const wrong = chk.mcq.options.find((o) => o.index !== chk.concept.practice.correct).index;
  assert.equal(F.answerExplainCheck(store, s.id, wrong).correct, false);
  assert.equal(F.answerExplainCheck(store, s.id, F.currentExplainCheck(s).concept.practice.correct).correct, true);
  assert.equal(s.explain.checkDone, true);
  F.tryAgain(store, s.id);
  assert.equal(s.state, 'READY');
  assert.equal(s.explain, null);
});

test('teach from the basics walks every prerequisite in dependency order ending at the target', () => {
  const store = fresh();
  const s = F.startSession(store, T, P);
  F.startExplanation(store, s.id, 'TEACH_FROM_BASICS');
  const ids = s.explain.concepts;
  assert.equal(ids[ids.length - 1], 'ideal_tx');
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.indexOf('alg_rearrange') < ids.indexOf('turns_ratio'));
  assert.ok(ids.indexOf('faraday') < ids.indexOf('turns_ratio'));
  assert.equal(ids.length, 6);
});

test('an explanation cannot be started in the middle of another step', () => {
  const store = fresh();
  const s = F.startSession(store, T, P);
  F.submitAttempt(store, s.id, '200 A', '');
  assert.equal(F.startExplanation(store, s.id, 'EXPLAIN_CONCEPT').ok, false);
});

test('a short right answer to an open question asks how the student got there before crediting mastery', () => {
  const { store, id } = withFixture();
  const s = F.startSession(store, id, 'q');
  const answer = 'Reparations and resentment.';
  const j = MT.custom.fixtureJudge(answer);
  assert.equal(j.isCorrect, true);
  const r = F.submitAttempt(store, s.id, answer, '', { judgement: j });
  assert.equal(s.state, 'REASONING_CHECK');
  assert.equal(r.diagnosis.category, 'CORRECT_ANSWER_UNVERIFIED_REASONING');
  assert.equal(store.events().filter((e) => e.type === 'OBSERVATION').length, 0, 'no mastery is credited yet');

  assert.equal(F.submitReasoning(store, s.id, 'ok', j).ok, false, 'too little to judge');
  const reasoning = 'The treaty forced reparations that wrecked the economy, and that resentment helped the Nazis and Hitler.';
  const done = F.submitReasoning(store, s.id, reasoning, MT.custom.fixtureJudge(answer + ' ' + reasoning));
  assert.ok(done.ok);
  assert.equal(s.state, 'ATTEMPT_CORRECT');
  assert.ok(store.events().some((e) => e.type === 'OBSERVATION' && e.correct));
  assert.equal(s.attempt.working, reasoning);
});

test('flawed reasoning after a right answer turns into a diagnosis, as in the spec\'s mole example', () => {
  const { store, id } = withFixture();
  const s = F.startSession(store, id, 'q');
  const answer = 'Reparations and resentment.';
  F.submitAttempt(store, s.id, answer, '', { judgement: MT.custom.fixtureJudge(answer) });
  const bad = 'I just guessed.';
  const out = F.submitReasoning(store, s.id, bad, MT.custom.fixtureJudge(bad));
  assert.ok(out.ok);
  assert.equal(s.state, 'PROBE_REQUIRED');
  assert.ok(F.currentProbe(s));
});

test('showing reasoning or giving a full answer skips the check, and numeric answers are never held up', () => {
  const { store, id } = withFixture();
  const s = F.startSession(store, id, 'q');
  const long = 'The treaty demanded reparations that wrecked the economy, feeding resentment that the Nazis used.';
  F.submitAttempt(store, s.id, long, '', { judgement: MT.custom.fixtureJudge(long) });
  assert.equal(s.state, 'ATTEMPT_CORRECT');
  const s2 = fresh();
  const n = F.startSession(s2, T, P);
  F.submitAttempt(s2, n.id, '2 A', '');
  assert.equal(n.state, 'ATTEMPT_CORRECT');
});
