const test = require('node:test');
const assert = require('node:assert/strict');
const MT = require('./load.js');
const F = MT.flow;

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
let clock = 5_000_000;
const mkStore = (storage) => MT.store.create({ storage: storage || mem(), now: () => (clock += 1000) });
const clone = (o) => JSON.parse(JSON.stringify(o));
const fixtureSpec = () => clone(MT.custom.FIXTURE.spec);
const wrongOption = (mcq, correct) => mcq.options.find((o) => o.index !== correct).index;

function withFixture(name) {
  const store = mkStore();
  store.signUp(name || 'Tess');
  const id = store.addCustomTrack({ question: MT.custom.FIXTURE.question, spec: MT.custom.FIXTURE.spec, source: 'fixture' });
  return { store, id, track: MT.data.track(id) };
}

test('the demo fixture is a valid spec and builds a valid track', () => {
  const v = MT.custom.validateSpec(fixtureSpec());
  assert.ok(v.ok, v.error);
  const track = MT.custom.buildTrack({ id: 'ask-x', spec: v.spec, question: MT.custom.FIXTURE.question, source: 'fixture' });
  assert.deepEqual(MT.graph.validate(track), []);
  assert.equal(track.problems[0].gen().answer.kind, 'open');
  assert.ok(track.verification.length >= 8);
  for (const t of track.verification) {
    const p = MT.data.instantiate(t, 1);
    assert.equal(p.answer.kind, 'choice');
    assert.ok(t.concept && track.concepts.some((c) => c.id === t.concept));
    assert.equal(new Set(p.answer.options).size, 3);
  }
});

test('validateSpec rejects malformed or unsafe generated maps', () => {
  const bad = [];
  const mut = (fn) => { const s = fixtureSpec(); fn(s); bad.push(s); };
  mut((s) => { s.nodes = s.nodes.slice(0, 3); });
  mut((s) => { s.nodes[0].id = 'Bad Id!'; });
  mut((s) => { s.nodes[1].id = s.nodes[0].id; });
  mut((s) => { s.target_node = 'nope'; });
  mut((s) => { s.nodes[0].level = 3; });
  mut((s) => { s.nodes[0].prior = 0.99; });
  mut((s) => { s.nodes[0].probe.options = ['a', 'b']; });
  mut((s) => { s.nodes[0].probe.options = ['same', 'same', 'other']; });
  mut((s) => { s.nodes[0].probe.correct_index = 5; });
  mut((s) => { s.nodes[0].verify = []; });
  mut((s) => { delete s.nodes[2].lesson.why; });
  mut((s) => { s.nodes[2].prereqs = [{ id: 'ghost', why: 'x' }]; });
  mut((s) => { s.nodes[2].prereqs = [{ id: 'reparations', why: 'self' }]; });
  mut((s) => { s.nodes[0].prereqs = [{ id: 'versailles_wwii', why: 'cycle' }]; });
  mut((s) => { s.nodes.push({ ...clone(s.nodes[0]), id: 'orphan_node', level: 1, prereqs: [] }); s.nodes.splice(0, 1); });
  for (const b of bad) assert.equal(MT.custom.validateSpec(b).ok, false, JSON.stringify(b).slice(0, 80));
  for (const x of [null, [], 'text', 42]) assert.equal(MT.custom.validateSpec(x).ok, false);
});

test('validateSpec cleans control characters and caps lengths', () => {
  const s = fixtureSpec();
  s.title = 'Title\u0000 with\u0007 junk ' + 'x'.repeat(500);
  const v = MT.custom.validateSpec(s);
  assert.ok(v.ok);
  assert.ok(!/[\u0000-\u001f]/.test(v.spec.title));
  assert.ok(v.spec.title.length <= 120);
});

test('generateTrack returns a validated spec, rejects bad output, and handles failures safely', async () => {
  const reply = (obj) => async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: typeof obj === 'string' ? obj : JSON.stringify(obj) }] } }] }) });
  let seen;
  const good = await MT.ai.generateTrack({ apiKey: 'KEY123', fetch: async (u, i) => { seen = { u, i }; return reply(fixtureSpec())(); } }, 'Explain how the Treaty of Versailles led to WWII.');
  assert.ok(good.ok, good.error);
  assert.ok(!seen.u.includes('KEY123'));
  const body = JSON.parse(seen.i.body);
  assert.equal(body.generationConfig.responseSchema.properties.nodes.type, 'ARRAY');
  assert.ok(body.contents[0].parts[0].text.includes('<question>'));

  const broken = fixtureSpec(); broken.nodes[0].probe.options = ['a', 'b'];
  assert.equal((await MT.ai.generateTrack({ apiKey: 'k', fetch: reply(broken) }, 'A long enough question here')).ok, false);
  assert.equal((await MT.ai.generateTrack({ apiKey: 'k', fetch: reply('not json') }, 'A long enough question here')).ok, false);
  assert.equal((await MT.ai.generateTrack({ apiKey: 'k', fetch: reply({}) }, 'A long enough question here')).ok, false);
  assert.match((await MT.ai.generateTrack({ apiKey: 'k', fetch: reply(fixtureSpec()) }, 'short')).error, /sentence/);
  assert.match((await MT.ai.generateTrack({ apiKey: 'k', fetch: reply(fixtureSpec()) }, 'x'.repeat(700))).error, /600/);
  assert.equal((await MT.ai.generateTrack({ fetch: reply(fixtureSpec()) }, 'A long enough question here')).ok, false);
  const down = await MT.ai.generateTrack({ apiKey: 'KEY123', fetch: async () => ({ ok: false, status: 429 }) }, 'A long enough question here');
  assert.ok(!down.ok && !down.error.includes('KEY123'));
});

test('validateJudgement accepts correct and incorrect verdicts and rejects invalid concept ids', () => {
  const { track } = withFixture();
  const ok = MT.ai.validateJudgement({ is_correct: false, category: 'PREREQUISITE_GAP', confidence: 0.5, suspected_concept_id: 'reparations', evidence_from_student_work: 'Skips the economy.' }, track);
  assert.ok(ok.ok); assert.equal(ok.value.isCorrect, false); assert.equal(ok.value.hintConcept, 'reparations');
  const right = MT.ai.validateJudgement({ is_correct: true, category: 'CORRECT', confidence: 0.9, suspected_concept_id: '', evidence_from_student_work: 'Links the terms to extremism.' }, track);
  assert.ok(right.ok); assert.equal(right.value.isCorrect, true); assert.match(right.value.evidence[0], /not deterministically verified/);
  for (const b of [{ is_correct: 'yes' }, { is_correct: false, category: 'PREREQUISITE_GAP', confidence: 0.5, suspected_concept_id: 'made_up', evidence_from_student_work: 'x' }, { is_correct: false, category: 'PREREQUISITE_GAP', confidence: 'high', suspected_concept_id: 'reparations', evidence_from_student_work: 'x' }, { is_correct: true, confidence: 1, evidence_from_student_work: '' }, 'junk']) {
    assert.equal(MT.ai.validateJudgement(b, track).ok, false, JSON.stringify(b));
  }
});

test('judgeOpen sends the question and concept ids and validates the reply', async () => {
  const { track } = withFixture();
  let body;
  const r = await MT.ai.judgeOpen({ apiKey: 'k', fetch: async (u, i) => { body = JSON.parse(i.body); return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ is_correct: false, category: 'CONCEPT_MISCONCEPTION', confidence: 0.6, suspected_concept_id: 'versailles_wwii', evidence_from_student_work: 'One-sided claim.' }) }] } }] }) }; } }, track, track.question, 'The treaty caused it.', '');
  assert.ok(r.ok);
  assert.equal(r.value.category, 'CONCEPT_MISCONCEPTION');
  assert.ok(body.contents[0].parts[0].text.includes('versailles_wwii'));
});

test('the demo rubric is deterministic and gives low confidence when it cannot tell', () => {
  const j = MT.custom.fixtureJudge;
  assert.equal(j('The treaty forced reparations that wrecked the economy and fed resentment that Hitler used.').isCorrect, true);
  const a = j('Germany had to pay reparations.');
  assert.deepEqual([a.isCorrect, a.hintConcept], [false, 'reparations']);
  const b = j('The treaty was unfair to Germany.');
  assert.deepEqual([b.isCorrect, b.hintConcept, b.confidence < 0.6], [false, 'ww1_settlement', true]);
  const c = j('It was bad.');
  assert.ok(c.confidence < 0.3);
  assert.equal(j('x').engine, 'demo-rubric');
});

test('classify handles open and choice answers', () => {
  const { track } = withFixture();
  const open = MT.data.instantiate(track.problems[0], 1);
  assert.equal(MT.diagnose.classify(track, open, 'ab', '').category, 'INVALID_INPUT');
  assert.equal(MT.diagnose.classify(track, open, 'Some real answer text', '').needsJudge, true);
  const v = MT.data.instantiate(track.verification.find((t) => t.concept === 'reparations'), 1);
  assert.equal(MT.diagnose.classify(track, v, String(v.answer.correct), '').category, 'CORRECT');
  const wrong = MT.diagnose.classify(track, v, String((v.answer.correct + 1) % 3), '');
  assert.equal(wrong.hintConcept, 'reparations');
  assert.equal(MT.diagnose.classify(track, v, 'banana', '').category, 'INVALID_INPUT');
});

test('open-ended journey: low-confidence follow-up probe, gap, recovery, fresh question, verified mastery', () => {
  const { store, id, track } = withFixture();
  const s = F.startSession(store, id, 'q');
  assert.equal(F.submitAttempt(store, s.id, 'The treaty was unfair to Germany.', '').ok, false, 'a judgement is required for open answers');
  const j = MT.custom.fixtureJudge('The treaty was unfair to Germany.');
  const r = F.submitAttempt(store, s.id, 'The treaty was unfair to Germany.', '', { judgement: j });
  assert.ok(r.ok);
  assert.equal(r.diagnosis.engine, 'demo-rubric');
  assert.ok(r.diagnosis.confidence < 0.6, 'weak evidence means the probe acts as a follow-up');
  assert.equal(s.state, 'PROBE_REQUIRED');
  assert.equal(F.currentProbe(s).concept.id, 'ww1_settlement');
  F.answerProbe(store, s.id, wrongOption(F.currentProbe(s).mcq, F.currentProbe(s).concept.probe.correct));
  assert.equal(s.state, 'GAP_CONFIRMED');
  F.beginRecovery(store, s.id); F.completeLesson(store, s.id);
  F.answerPractice(store, s.id, F.currentPractice(s).concept.practice.correct);
  F.startVerification(store, s.id);
  const vp = F.verificationProblem(s);
  assert.equal(vp.concept, 'ww1_settlement', 'the fresh question tests the recovered concept');
  assert.notEqual(vp.statement, track.question);
  assert.equal(vp.answer.kind, 'choice');
  let v = F.submitVerification(store, s.id, String(vp.answer.correct), '');
  let guard = 0;
  while (v.outcome === 'NEEDS_MORE' && guard++ < 4) v = F.submitVerification(store, s.id, String(F.verificationProblem(s).answer.correct), '');
  assert.equal(v.outcome, 'VERIFIED');
  assert.ok(store.p(id, 'ww1_settlement') >= 0.8);
  F.tryAgain(store, s.id);
  const ok = F.submitAttempt(store, s.id, 'Reparations wrecked the economy, creating resentment that the Nazis exploited.', '', { judgement: MT.custom.fixtureJudge('Reparations wrecked the economy, creating resentment that the Nazis exploited.') });
  assert.equal(ok.diagnosis.category, 'CORRECT');
  assert.equal(s.state, 'ATTEMPT_CORRECT');
});

test('a wrong fresh question sends the student back to recovery', () => {
  const { store, id } = withFixture();
  const s = F.startSession(store, id, 'q');
  F.submitAttempt(store, s.id, 'Germany had to pay reparations.', '', { judgement: MT.custom.fixtureJudge('Germany had to pay reparations.') });
  const pr = F.currentProbe(s);
  F.answerProbe(store, s.id, wrongOption(pr.mcq, pr.concept.probe.correct));
  F.beginRecovery(store, s.id); F.completeLesson(store, s.id);
  F.answerPractice(store, s.id, F.currentPractice(s).concept.practice.correct);
  F.startVerification(store, s.id);
  const vp = F.verificationProblem(s);
  const out = F.submitVerification(store, s.id, String((vp.answer.correct + 1) % 3), '');
  assert.equal(out.outcome, 'SAME_GAP');
  assert.equal(s.state, 'RECOVERY_REQUIRED');
});

test('a correct AI judgement is labelled and credits the target concept', () => {
  const { store, id, track } = withFixture();
  const s = F.startSession(store, id, 'q');
  const j = { engine: 'gemini', isCorrect: true, category: 'CORRECT', confidence: 0.9, hintConcept: null, evidence: ['AI judgement (not deterministically verified): linked.'] };
  const r = F.submitAttempt(store, s.id, 'A well argued essay answer.', '', { judgement: j });
  assert.equal(r.diagnosis.category, 'CORRECT');
  assert.equal(r.diagnosis.engine, 'gemini');
  assert.ok(store.p(id, track.target) > 0.45);
});

test('custom questions persist, are private to the profile, and can be removed with their data', () => {
  const storage = mem();
  const s1 = mkStore(storage);
  s1.signUp('Asha');
  const id = s1.addCustomTrack({ question: MT.custom.FIXTURE.question, spec: MT.custom.FIXTURE.spec, source: 'fixture' });
  assert.equal(s1.addCustomTrack({ question: MT.custom.FIXTURE.question, spec: MT.custom.FIXTURE.spec }), id, 'the same question is not added twice');
  const s = F.startSession(s1, id, 'q');
  F.submitAttempt(s1, s.id, 'The treaty was unfair to Germany.', '', { judgement: MT.custom.fixtureJudge('The treaty was unfair to Germany.') });
  assert.ok(MT.data.track(id));

  const s2 = mkStore(storage);
  assert.ok(MT.data.track(id), 'rebuilt after a reload');
  assert.equal(s2.getSession(s.id).state, 'PROBE_REQUIRED');
  s2.signOut();
  assert.equal(MT.data.track(id), null, 'hidden when signed out');
  s2.signUp('Bilal');
  assert.equal(MT.data.track(id), null, 'another profile does not see it');
  s2.signIn(s1.profiles().find((p) => p.name === 'Asha').id);
  assert.ok(MT.data.track(id));

  s2.removeCustomTrack(id);
  assert.equal(MT.data.track(id), null);
  assert.equal(s2.sessionList().length, 0);
  assert.equal(s2.events().filter((e) => e.trackId === id).length, 0);
  assert.deepEqual(Object.keys(s2.data().mastery).filter((k) => k.startsWith(id)), []);
  MT.data.setCustom([]);
});

test('saves from before custom questions existed still load', () => {
  const storage = mem();
  const s1 = mkStore(storage); s1.signUp('Old');
  delete s1.data().customs; s1.commit();
  const s2 = mkStore(storage);
  assert.deepEqual(s2.customTracks(), []);
});
