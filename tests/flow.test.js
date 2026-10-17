const test = require('node:test');
const assert = require('node:assert/strict');
const MT = require('./load.js');
const F = MT.flow;

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
let clock = 1_000_000;
const fresh = () => { const s = MT.store.create({ storage: mem(), now: () => (clock += 1000) }); s.signUp('Test'); return s; };
const T = 'eee-transformers';
const P = 'tx-secondary-current';

const wrongOption = (mcq, correctIndex) => mcq.options.find((o) => o.index !== correctIndex).index;
const rightOption = (c) => c.probe.correct;

test('acceptance journey: wrong attempt to verified mastery, with graph and persistence', () => {
  const storage = mem();
  const store = MT.store.create({ storage, now: () => (clock += 1000) });
  store.signUp('Judge');
  const s = F.startSession(store, T, P);
  assert.equal(s.state, 'READY');

  // 1-2. wrong attempt -> diagnosis
  let r = F.submitAttempt(store, s.id, '200 A', 'V2 = 240 x 10 = 2400 V, I2 = 2400/12');
  assert.ok(r.ok);
  assert.equal(s.state, 'PROBE_REQUIRED');
  assert.equal(r.diagnosis.category, 'PREREQUISITE_GAP');
  const pTR0 = store.p(T, 'turns_ratio');
  assert.equal(store.graphState(T).turns_ratio.status, 'SUSPECTED_GAP', 'suspect is shown but not confirmed');
  assert.equal(store.record(T, 'turns_ratio').fails, 0, 'no evidence recorded yet');

  // 3-5. probe fails -> confirmed gap
  const probe = F.currentProbe(s);
  assert.equal(probe.concept.id, 'turns_ratio');
  const pr = F.answerProbe(store, s.id, wrongOption(probe.mcq, probe.concept.probe.correct));
  assert.equal(pr.outcome, 'GAP_CONFIRMED');
  assert.equal(s.state, 'GAP_CONFIRMED');
  assert.ok(store.p(T, 'turns_ratio') < pTR0);
  assert.equal(store.graphState(T).turns_ratio.status, 'CONFIRMED_GAP');
  assert.equal(store.graphState(T).ideal_tx.status, 'BLOCKED');
  assert.ok(F.lockedBy(store, T, P).includes('turns_ratio'));
  assert.equal(F.submitAttempt(store, s.id, '2 A', '').ok, false);

  // 6-7. recovery: learning only after the lesson
  F.beginRecovery(store, s.id);
  assert.equal(s.state, 'RECOVERY_IN_PROGRESS');
  const pBeforeLesson = store.p(T, 'turns_ratio');
  const learned = F.completeLesson(store, s.id);
  assert.ok(learned.learn.after > pBeforeLesson);
  assert.equal(F.completeLesson(store, s.id).ok, false, 'learning transition cannot be applied twice');
  const prac = F.currentPractice(s);
  const bad = F.answerPractice(store, s.id, wrongOption(prac.mcq, prac.concept.practice.correct));
  assert.equal(bad.correct, false);
  assert.equal(F.startVerification(store, s.id).ok, false, 'verification is locked until practice is passed');
  const good = F.answerPractice(store, s.id, prac.concept.practice.correct);
  assert.equal(good.correct, true);

  // 8-10. fresh verification
  assert.ok(F.startVerification(store, s.id).ok);
  assert.equal(s.state, 'VERIFICATION_REQUIRED');
  const vp = F.verificationProblem(s);
  assert.notEqual(vp.statement, F.originalProblem(s).statement, 'verification problem is fresh');
  let v = F.submitVerification(store, s.id, vp.answer.display, '');
  while (v.outcome === 'NEEDS_MORE') v = F.submitVerification(store, s.id, F.verificationProblem(s).answer.display, '');
  assert.equal(v.outcome, 'VERIFIED');
  assert.equal(s.state, 'MASTERY_VERIFIED');
  assert.ok(store.p(T, 'turns_ratio') >= 0.8);
  const gs = store.graphState(T);
  assert.equal(gs.turns_ratio.status, 'MASTERED');
  assert.notEqual(gs.ideal_tx.status, 'BLOCKED', 'dependent problem unlocked');
  assert.deepEqual(F.lockedBy(store, T, P), []);

  // retry the original and solve it
  F.tryAgain(store, s.id);
  assert.equal(s.state, 'READY');
  const solved = F.submitAttempt(store, s.id, '2 A', 'V2 = 24 V, I2 = 2 A');
  assert.equal(solved.diagnosis.category, 'CORRECT');
  assert.equal(s.state, 'ATTEMPT_CORRECT');

  // 11. persistence: a new store instance sees everything
  const again = MT.store.create({ storage, now: () => (clock += 1000) });
  assert.equal(again.getSession(s.id).state, 'ATTEMPT_CORRECT');
  assert.ok(again.p(T, 'turns_ratio') >= 0.8);
  const types = again.events().map((e) => e.type);
  for (const t of ['ATTEMPT', 'OBSERVATION', 'LEARNING', 'RECOVERY_STARTED', 'MASTERY_VERIFIED']) assert.ok(types.includes(t), t);
});

test('a careless slip changes no mastery and asks for a retry', () => {
  const store = fresh();
  const s = F.startSession(store, T, P);
  const before = JSON.stringify(store.masteryMap(T));
  const r = F.submitAttempt(store, s.id, '2.1 A', 'V2 = 24 V');
  assert.equal(r.diagnosis.category, 'CARELESS_SLIP');
  assert.equal(s.state, 'RETRY_REQUIRED');
  assert.equal(JSON.stringify(store.masteryMap(T)), before);
  assert.equal(store.events().filter((e) => e.type === 'OBSERVATION').length, 0);
  F.tryAgain(store, s.id);
  assert.equal(s.state, 'READY');
});

test('a passed probe rejects the hypothesis and moves to the next candidate', () => {
  const store = fresh();
  const s = F.startSession(store, T, P);
  F.submitAttempt(store, s.id, '200 A', '');
  const first = F.currentProbe(s);
  const r = F.answerProbe(store, s.id, first.concept.probe.correct);
  assert.equal(r.outcome, 'NEXT_PROBE');
  assert.equal(s.state, 'PROBE_REQUIRED');
  assert.notEqual(F.currentProbe(s).concept.id, first.concept.id);
  assert.ok(store.p(T, first.concept.id) > first.concept.prior);
});

test('if every probe passes, no gap is confirmed and the student retries without penalty to prerequisites', () => {
  const store = fresh();
  const s = F.startSession(store, T, P);
  F.submitAttempt(store, s.id, '200 A', '');
  let guard = 0;
  while (s.state === 'PROBE_REQUIRED' && guard++ < 5) F.answerProbe(store, s.id, F.currentProbe(s).concept.probe.correct);
  assert.equal(s.state, 'RETRY_REQUIRED');
  assert.equal(s.gap, null);
  assert.ok(s.probes.length <= F.MAX_PROBES);
});

test('a failed verification on the same concept sends the student back to recovery', () => {
  const store = fresh();
  const s = F.startSession(store, T, P);
  F.submitAttempt(store, s.id, '200 A', '');
  const pr = F.currentProbe(s);
  F.answerProbe(store, s.id, wrongOption(pr.mcq, pr.concept.probe.correct));
  F.beginRecovery(store, s.id); F.completeLesson(store, s.id);
  const prac = F.currentPractice(s); F.answerPractice(store, s.id, prac.concept.practice.correct);
  F.startVerification(store, s.id);
  const vp = F.verificationProblem(s);
  const inverted = vp.patterns.find((p) => p.concept === 'turns_ratio' && p.cat === 'PREREQUISITE_GAP' && /upside down/.test(p.evidence));
  const v = F.submitVerification(store, s.id, inverted.value + ' A', '');
  assert.equal(v.outcome, 'SAME_GAP');
  assert.equal(s.state, 'RECOVERY_REQUIRED');
  F.beginRecovery(store, s.id);
  assert.equal(s.state, 'RECOVERY_IN_PROGRESS');
  assert.equal(s.recovery.step, 'lesson');
});

test('a different kind of error during verification does not penalise the recovered concept', () => {
  const store = fresh();
  const s = F.startSession(store, T, P);
  F.submitAttempt(store, s.id, '200 A', '');
  const pr = F.currentProbe(s);
  F.answerProbe(store, s.id, wrongOption(pr.mcq, pr.concept.probe.correct));
  F.beginRecovery(store, s.id); F.completeLesson(store, s.id);
  F.answerPractice(store, s.id, F.currentPractice(s).concept.practice.correct);
  F.startVerification(store, s.id);
  const before = store.p(T, 'turns_ratio');
  const vp = F.verificationProblem(s);
  const v = F.submitVerification(store, s.id, vp.answer.value * 1.03 + ' A', '');
  assert.equal(v.outcome, 'OTHER_ERROR');
  assert.equal(store.p(T, 'turns_ratio'), before);
  assert.equal(s.state, 'VERIFICATION_REQUIRED');
});

test('recovery started from the knowledge map reaches verification', () => {
  const store = fresh();
  store.observe(T, 'alg_rearrange', false, {});
  const s = F.startRecoveryFor(store, T, 'alg_rearrange');
  assert.equal(s.state, 'RECOVERY_IN_PROGRESS');
  assert.equal(F.startRecoveryFor(store, T, 'alg_rearrange').id, s.id, 'resumes the open session');
  F.completeLesson(store, s.id);
  F.answerPractice(store, s.id, F.currentPractice(s).concept.practice.correct);
  assert.ok(F.startVerification(store, s.id).ok);
});

test('invalid answers do not change state', () => {
  const store = fresh();
  const s = F.startSession(store, T, P);
  const r = F.submitAttempt(store, s.id, 'a lot', '');
  assert.equal(r.ok, false);
  assert.equal(s.state, 'READY');
  assert.equal(s.attemptCount, 0);
});

test('a repeated unit error escalates to a unit_conv probe, a single one does not', () => {
  const store = fresh();
  const s = F.startSession(store, T, 'tx-kv-primary');
  const r = F.submitAttempt(store, s.id, '0.02 A', '');
  assert.equal(r.diagnosis.category, 'UNIT_ERROR');
  assert.equal(s.state, 'RETRY_REQUIRED');
  assert.equal(store.events().filter((e) => e.type === 'OBSERVATION').length, 0, 'a single unit slip changes no mastery');
  F.tryAgain(store, s.id);
  F.submitAttempt(store, s.id, '0.02 A', '');
  assert.equal(s.state, 'PROBE_REQUIRED');
  assert.equal(F.currentProbe(s).concept.id, 'unit_conv');
});

test('every track completes the full loop with deterministic fixtures', () => {
  for (const track of MT.data.tracks) {
    const store = fresh();
    const def = track.problems[0];
    const s = F.startSession(store, track.id, def.id);
    const problem = F.originalProblem(s);
    const pat = problem.patterns.find((p) => p.concept && p.cat === 'PREREQUISITE_GAP');
    const ans = problem.answer.kind === 'expr' ? pat.expr : pat.value + (problem.answer.unit ? ' ' + problem.answer.unit : '');
    F.submitAttempt(store, s.id, ans, '');
    assert.equal(s.state, 'PROBE_REQUIRED', track.id);
    let guard = 0;
    while (s.state === 'PROBE_REQUIRED' && guard++ < 4) {
      const pr = F.currentProbe(s);
      F.answerProbe(store, s.id, pr.concept.id === pat.concept ? wrongOption(pr.mcq, pr.concept.probe.correct) : pr.concept.probe.correct);
    }
    assert.equal(s.state, 'GAP_CONFIRMED', track.id);
    assert.equal(s.gap.conceptId, pat.concept);
    F.beginRecovery(store, s.id); F.completeLesson(store, s.id);
    F.answerPractice(store, s.id, F.currentPractice(s).concept.practice.correct);
    F.startVerification(store, s.id);
    let v = F.submitVerification(store, s.id, (() => { const p = F.verificationProblem(s); return p.answer.kind === 'expr' ? p.answer.expr : p.answer.value + (p.answer.unit ? ' ' + p.answer.unit : ''); })(), '');
    guard = 0;
    while (v.outcome === 'NEEDS_MORE' && guard++ < 4) { const p = F.verificationProblem(s); v = F.submitVerification(store, s.id, p.answer.kind === 'expr' ? p.answer.expr : p.answer.value + (p.answer.unit ? ' ' + p.answer.unit : ''), ''); }
    assert.equal(v.outcome, 'VERIFIED', track.id);
  }
});

test('nextAction prefers an open session, then recovery, then a new problem', () => {
  const store = fresh();
  assert.equal(F.nextAction(store).kind, 'try');
  const s = F.startSession(store, T, P);
  F.submitAttempt(store, s.id, '200 A', '');
  assert.equal(F.nextAction(store).kind, 'continue');
  store.closeSession(s.id);
  store.observe(T, 'ohms_law', false, {});
  assert.equal(F.nextAction(store).kind, 'recover');
});
