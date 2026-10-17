const test = require('node:test');
const assert = require('node:assert/strict');
const MT = require('./load.js');
const M = MT.machine;

const at = (state) => ({ state, log: [] });

test('every state has a transition entry and every target is a real state', () => {
  for (const s of M.STATES) assert.ok(M.TRANSITIONS[s], s);
  for (const [from, tos] of Object.entries(M.TRANSITIONS)) {
    assert.ok(M.STATES.includes(from));
    for (const t of tos) assert.ok(M.STATES.includes(t), from + '->' + t);
  }
});

test('the full recovery path is legal', () => {
  const s = at('READY');
  for (const to of ['ATTEMPT_SUBMITTED', 'ERROR_CLASSIFIED', 'PROBE_REQUIRED', 'GAP_CONFIRMED', 'RECOVERY_REQUIRED', 'RECOVERY_IN_PROGRESS', 'VERIFICATION_REQUIRED', 'MASTERY_VERIFIED', 'RETRY_REQUIRED', 'ATTEMPT_SUBMITTED', 'ATTEMPT_CORRECT', 'READY']) {
    M.transition(s, to);
  }
  assert.equal(s.state, 'READY');
  assert.equal(s.log.length, 12);
  assert.equal(s.log[0].from, 'READY');
});

test('illegal transitions throw and leave the session untouched', () => {
  const cases = [
    ['READY', 'MASTERY_VERIFIED'], ['READY', 'GAP_CONFIRMED'], ['ERROR_CLASSIFIED', 'RECOVERY_IN_PROGRESS'],
    ['PROBE_REQUIRED', 'VERIFICATION_REQUIRED'], ['GAP_CONFIRMED', 'MASTERY_VERIFIED'], ['RECOVERY_REQUIRED', 'VERIFICATION_REQUIRED'],
    ['VERIFICATION_REQUIRED', 'READY'], ['ATTEMPT_CORRECT', 'GAP_CONFIRMED'], ['MASTERY_VERIFIED', 'GAP_CONFIRMED'],
  ];
  for (const [from, to] of cases) {
    const s = at(from);
    assert.throws(() => M.transition(s, to), M.IllegalTransition, from + '->' + to);
    assert.equal(s.state, from);
    assert.equal(s.log.length, 0);
  }
  assert.throws(() => M.transition(at('READY'), 'NOT_A_STATE'), M.IllegalTransition);
});

test('verification cannot succeed without passing through recovery', () => {
  // Every path to MASTERY_VERIFIED goes through VERIFICATION_REQUIRED, which only RECOVERY_IN_PROGRESS reaches.
  const into = (t) => M.STATES.filter((s) => M.TRANSITIONS[s].includes(t));
  assert.deepEqual(into('MASTERY_VERIFIED'), ['VERIFICATION_REQUIRED']);
  assert.deepEqual(into('VERIFICATION_REQUIRED'), ['RECOVERY_IN_PROGRESS']);
  assert.deepEqual(into('GAP_CONFIRMED'), ['PROBE_REQUIRED']);
});

test('a failed verification returns to recovery', () => {
  const s = at('VERIFICATION_REQUIRED');
  M.transition(s, 'RECOVERY_REQUIRED', 'verification failed');
  assert.equal(s.state, 'RECOVERY_REQUIRED');
});
