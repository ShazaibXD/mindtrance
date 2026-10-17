/* Bayesian Knowledge Tracing: transparent baseline mastery engine.
 * Observations (answers) and learning transitions (interventions) are separate calls. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});

  const DEFAULTS = Object.freeze({
    pSlip: 0.10,
    pGuess: 0.20,
    pTransit: 0.25,
    masteredAt: 0.80,
    gapBelow: 0.45,
  });
  const EPS = 1e-4;

  function assertProb(name, v) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v >= 1) {
      throw new RangeError(name + ' must be a number strictly between 0 and 1, got ' + v);
    }
  }

  function validateParams(params) {
    const p = Object.assign({}, DEFAULTS, params || {});
    assertProb('pSlip', p.pSlip);
    assertProb('pGuess', p.pGuess);
    assertProb('pTransit', p.pTransit);
    assertProb('masteredAt', p.masteredAt);
    assertProb('gapBelow', p.gapBelow);
    if (p.pSlip + p.pGuess >= 1) throw new RangeError('pSlip + pGuess must be below 1 (model must be identifiable)');
    if (p.gapBelow >= p.masteredAt) throw new RangeError('gapBelow must be below masteredAt');
    return p;
  }

  function clampP(p) {
    if (typeof p !== 'number' || !Number.isFinite(p)) throw new RangeError('mastery must be a finite number');
    return Math.min(1 - EPS, Math.max(EPS, p));
  }

  /* P(L | observation). Does not apply any learning. */
  function posterior(prior, correct, params) {
    const q = validateParams(params);
    const L = clampP(prior);
    const S = q.pSlip;
    const G = q.pGuess;
    if (correct) return (L * (1 - S)) / (L * (1 - S) + (1 - L) * G);
    return (L * S) / (L * S + (1 - L) * (1 - G));
  }

  /* Record an answer. Returns the updated mastery estimate with no learning transition. */
  function observe(prior, correct, params) {
    const post = posterior(prior, correct, params);
    return { before: prior, posterior: post, after: clampP(post), correct: !!correct };
  }

  /* Apply a learning transition. Only call after a real recovery intervention. */
  function learn(prior, params) {
    const q = validateParams(params);
    const L = clampP(prior);
    return clampP(L + (1 - L) * q.pTransit);
  }

  function status(p, params) {
    const q = validateParams(params);
    if (p >= q.masteredAt) return 'MASTERED';
    if (p >= q.gapBelow) return 'NEEDS_VERIFICATION';
    return 'CONFIRMED_GAP';
  }

  MT.bkt = { DEFAULTS, EPS, validateParams, clampP, posterior, observe, learn, status };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.bkt;
})(typeof window !== 'undefined' ? window : globalThis);
