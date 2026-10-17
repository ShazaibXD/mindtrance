const test = require('node:test');
const assert = require('node:assert/strict');
const MT = require('./load.js');

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };
const T = 'eee-transformers';
let t = 1000;
const mk = (storage) => MT.store.create({ storage: storage || mem(), now: () => ++t });

test('profile sign-up validates names and rejects duplicates', () => {
  const s = mk();
  assert.equal(s.signUp('A').ok, false);
  assert.equal(s.signUp('x'.repeat(41)).ok, false);
  assert.equal(s.signUp('  Asha   Rao ').ok, true);
  assert.equal(s.profile().name, 'Asha Rao');
  assert.equal(s.signUp('asha rao').ok, false);
});

test('sign out hides data and sign in restores it; profiles are isolated', () => {
  const s = mk();
  const a = s.signUp('Asha').id;
  s.observe(T, 'turns_ratio', false, {});
  const pa = s.p(T, 'turns_ratio');
  s.signOut();
  assert.equal(s.profile(), null);
  assert.throws(() => s.data());
  const b = s.signUp('Bilal').id;
  assert.equal(s.p(T, 'turns_ratio'), 0.55, 'a new profile starts from priors');
  s.signIn(a);
  assert.equal(s.p(T, 'turns_ratio'), pa);
  assert.equal(s.signIn('nope').ok, false);
  assert.ok(b);
});

test('data persists across store instances (page refresh)', () => {
  const storage = mem();
  const s1 = mk(storage);
  s1.signUp('Asha');
  s1.observe(T, 'turns_ratio', false, {});
  const after = s1.p(T, 'turns_ratio');
  const s2 = mk(storage);
  assert.equal(s2.profile().name, 'Asha');
  assert.equal(s2.p(T, 'turns_ratio'), after);
  assert.equal(s2.events().length, 1);
});

test('corrupt or foreign storage is ignored, not fatal', () => {
  const storage = mem();
  storage.setItem(MT.store.KEY, '{not json');
  assert.equal(mk(storage).profiles().length, 0);
  storage.setItem(MT.store.KEY, JSON.stringify({ v: 99, profiles: {} }));
  assert.equal(mk(storage).profiles().length, 0);
});

test('observe records evidence; learn is a separate event', () => {
  const s = mk(); s.signUp('Asha');
  const o = s.observe(T, 'alg_rearrange', false, { sessionId: 's1' });
  assert.ok(o.after < o.before);
  assert.equal(s.record(T, 'alg_rearrange').fails, 1);
  const l = s.learn(T, 'alg_rearrange', {});
  assert.ok(l.after > l.before);
  const types = s.events().map((e) => e.type);
  assert.deepEqual(types, ['OBSERVATION', 'LEARNING']);
  assert.equal(s.record(T, 'alg_rearrange').obs, 1, 'learning does not count as an observation');
});

test('a low prior alone is not a confirmed gap; a failed observation is', () => {
  const s = mk(); s.signUp('Asha');
  assert.equal(s.conceptState(T, 'turns_ratio').status, 'NEEDS_VERIFICATION');
  s.observe(T, 'turns_ratio', false, {});
  assert.equal(s.conceptState(T, 'turns_ratio').status, 'CONFIRMED_GAP');
});

test('graphState blocks dependents of a confirmed gap and marks suspects', () => {
  const s = mk(); s.signUp('Asha');
  s.observe(T, 'turns_ratio', false, {});
  const gs = s.graphState(T);
  assert.equal(gs.turns_ratio.status, 'CONFIRMED_GAP');
  assert.equal(gs.ideal_tx.status, 'BLOCKED');
  assert.ok(gs.ideal_tx.blockedBy.includes('turns_ratio'));
  assert.equal(gs.ohms_law.status, 'MASTERED');
  const sess = s.newSession({ trackId: T, problemId: 'tx-secondary-current', state: 'PROBE_REQUIRED', diagnosis: { candidates: [{ id: 'unit_conv' }] }, probeIndex: 0 });
  assert.ok(sess.id);
  assert.equal(s.graphState(T).unit_conv.status, 'SUSPECTED_GAP');
});

test('sessions persist, list by recency and resolve the active one per problem', () => {
  const storage = mem();
  const s = mk(storage); s.signUp('Asha');
  const a = s.newSession({ trackId: T, problemId: 'p1' });
  const b = s.newSession({ trackId: T, problemId: 'p2' });
  s.touch(a);
  assert.equal(s.sessionList()[0].id, a.id);
  assert.equal(s.activeFor(T, 'p2').id, b.id);
  s.closeSession(b.id);
  assert.equal(s.activeFor(T, 'p2'), null);
  assert.equal(mk(storage).getSession(a.id).problemId, 'p1');
});

test('reset clears progress; export omits the API key', () => {
  const s = mk(); s.signUp('Asha');
  s.observe(T, 'ohms_law', true, {});
  s.updateSettings({ geminiKey: 'SECRET-KEY' });
  assert.ok(!s.exportData().includes('SECRET-KEY'));
  s.resetProgress();
  assert.equal(s.events().length, 0);
  assert.equal(s.p(T, 'ohms_law'), 0.8);
});

test('unknown concepts throw instead of silently creating mastery', () => {
  const s = mk(); s.signUp('Asha');
  assert.throws(() => s.observe(T, 'made_up', true, {}));
});

test('subscribers are notified on changes', () => {
  const s = mk(); s.signUp('Asha');
  let n = 0;
  const off = s.subscribe(() => n++);
  s.observe(T, 'ohms_law', true, {});
  off();
  s.observe(T, 'ohms_law', true, {});
  assert.equal(n, 1);
});
