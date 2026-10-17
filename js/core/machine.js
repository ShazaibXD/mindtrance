/* Explicit diagnostic state machine. Illegal transitions throw. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});

  const STATES = [
    'READY', 'ATTEMPT_SUBMITTED', 'ATTEMPT_CORRECT', 'ERROR_CLASSIFIED', 'PROBE_REQUIRED', 'GAP_CONFIRMED',
    'RECOVERY_REQUIRED', 'RECOVERY_IN_PROGRESS', 'VERIFICATION_REQUIRED', 'MASTERY_VERIFIED', 'RETRY_REQUIRED',
  ];

  const TRANSITIONS = {
    READY: ['ATTEMPT_SUBMITTED', 'RECOVERY_REQUIRED'],
    ATTEMPT_SUBMITTED: ['ATTEMPT_CORRECT', 'ERROR_CLASSIFIED'],
    ATTEMPT_CORRECT: ['READY'],
    ERROR_CLASSIFIED: ['PROBE_REQUIRED', 'RETRY_REQUIRED'],
    PROBE_REQUIRED: ['PROBE_REQUIRED', 'GAP_CONFIRMED', 'RETRY_REQUIRED'],
    GAP_CONFIRMED: ['RECOVERY_REQUIRED'],
    RECOVERY_REQUIRED: ['RECOVERY_IN_PROGRESS'],
    RECOVERY_IN_PROGRESS: ['VERIFICATION_REQUIRED'],
    VERIFICATION_REQUIRED: ['MASTERY_VERIFIED', 'RECOVERY_REQUIRED'],
    MASTERY_VERIFIED: ['RETRY_REQUIRED', 'READY'],
    RETRY_REQUIRED: ['READY', 'ATTEMPT_SUBMITTED'],
  };

  class IllegalTransition extends Error {
    constructor(from, to) {
      super('Illegal transition ' + from + ' -> ' + to);
      this.name = 'IllegalTransition';
      this.from = from;
      this.to = to;
    }
  }

  const canTransition = (from, to) => (TRANSITIONS[from] || []).includes(to);

  function transition(session, to, note, now) {
    if (!STATES.includes(to)) throw new IllegalTransition(session.state, to);
    if (!canTransition(session.state, to)) throw new IllegalTransition(session.state, to);
    session.log = session.log || [];
    session.log.push({ from: session.state, to, note: note || '', at: now != null ? now : Date.now() });
    session.state = to;
    return session;
  }

  MT.machine = { STATES, TRANSITIONS, IllegalTransition, canTransition, transition };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.machine;
})(typeof window !== 'undefined' ? window : globalThis);
