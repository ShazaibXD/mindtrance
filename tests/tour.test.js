const test = require('node:test');
const assert = require('node:assert/strict');
const MT = require('./load.js');
require('../js/ui/util.js');
require('../js/ui/demo.js');
const T = MT.tour;

const base = { trackId: T.TRACK, problemId: T.PROBLEM, draftsFilled: false, conceptName: (id) => 'Concept ' + id, mapHref: '#map', askHref: '#ask' };
const at = (state, extra) => T.step(Object.assign({}, base, { session: Object.assign({ state, probes: [], probeIndex: 0 }, extra) }));

test('the tour only applies to the demo problem', () => {
  assert.ok(T.isTourProblem('eee-transformers', 'tx-secondary-current'));
  assert.ok(!T.isTourProblem('eee-transformers', 'tx-kv-primary'));
  assert.ok(!T.isTourProblem('gate-subnet', 'tx-secondary-current'));
});

test('each state of a session maps to one numbered step with a title and an explanation', () => {
  const cases = [
    [T.step(Object.assign({}, base, { session: null })), 1],
    [T.step(Object.assign({}, base, { session: null, draftsFilled: true })), 2],
    [at('PROBE_REQUIRED', { diagnosis: { evidenceScore: 0.35, candidates: [{ id: 'turns_ratio' }] } }), 3],
    [at('GAP_CONFIRMED', { gap: { conceptId: 'turns_ratio', p: 0.15, confirmedBy: 'probe' }, probes: [{ before: 0.55 }], diagnosis: { evidenceScore: 0.35 } }), 4],
    [at('RECOVERY_IN_PROGRESS', { recovery: { step: 'lesson' } }), 5],
    [at('RECOVERY_IN_PROGRESS', { recovery: { step: 'practice' } }), 6],
    [at('RECOVERY_IN_PROGRESS', { recovery: { step: 'done' } }), 6],
    [at('VERIFICATION_REQUIRED', { verification: { attempts: [] } }), 7],
    [at('MASTERY_VERIFIED', { result: { verified: true, conceptId: 'turns_ratio', before: 0.2, after: 0.9 } }), 8],
    [T.step(Object.assign({}, base, { session: { state: 'READY', result: { verified: true } } })), 9],
    [at('ATTEMPT_CORRECT'), 9],
  ];
  for (const [info, n] of cases) { assert.equal(info.n, n, info.title); assert.ok(info.title && info.body); }
  assert.ok(T.TOTAL >= 9);
});

test('step text uses the real numbers from the session, not canned ones', () => {
  const info = at('GAP_CONFIRMED', { gap: { conceptId: 'turns_ratio', p: 0.15, confirmedBy: 'probe' }, probes: [{ before: 0.55 }], diagnosis: { evidenceScore: 0.35 } });
  assert.match(info.body, /from 0\.55 to 0\.15/);
  const ev = at('GAP_CONFIRMED', { gap: { conceptId: 'turns_ratio', p: 0.11, confirmedBy: 'evidence' }, diagnosis: { evidenceScore: 0.935 } });
  assert.match(ev.body, /94%/);
  assert.match(ev.body, /no extra question was needed/);
  const probe = at('PROBE_REQUIRED', { diagnosis: { evidenceScore: 0.35, candidates: [{ id: 'turns_ratio' }] } });
  assert.match(probe.body, /35%/);
  assert.match(probe.body, /Concept turns_ratio/);
  const done = at('MASTERY_VERIFIED', { result: { verified: true, conceptId: 'turns_ratio', before: 0.2, after: 0.91 } });
  assert.match(done.body, /0\.20 to 0\.91/);
});

test('a second probe is explained as ruling out the previous suspect', () => {
  const info = at('PROBE_REQUIRED', { probes: [{ conceptId: 'x' }], probeIndex: 1, diagnosis: { evidenceScore: 0.35, candidates: [{ id: 'a' }, { id: 'b' }] } });
  assert.match(info.body, /rules out/);
});

test('every step that offers an action names a real action or link, and steps avoid the headings the page already has', () => {
  const clash = /^(Diagnosis|Gap confirmed|Mastery verified|Fresh verification problem|Correct)$/;
  const infos = [T.step(Object.assign({}, base, { session: null })), at('PROBE_REQUIRED', { diagnosis: { evidenceScore: 0.35, candidates: [{ id: 'a' }] } }), at('ATTEMPT_CORRECT'), at('ESCALATED_TO_SOLUTION')];
  for (const i of infos) {
    assert.ok(!clash.test(i.title), i.title);
    for (const c of i.cta || []) assert.ok(c.action || c.href, c.label);
  }
});

test('the panel is escaped and shows progress dots', () => {
  const html = T.panelHtml({ n: 3, title: '<img src=x onerror=1>', body: 'b', cta: [{ label: 'Go', action: 'x', primary: true }] });
  assert.ok(!html.includes('<img'));
  assert.equal((html.match(/<span class="(done|now)?"><\/span>/g) || []).length, T.TOTAL);
  assert.match(html, /Step 3 of 9/);
});

test('off-path states get a friendly restart instead of a dead end', () => {
  const info = at('ESCALATED_TO_SOLUTION');
  assert.equal(info.n, null);
  assert.equal(info.cta[0].action, 'demo-reset');
});
