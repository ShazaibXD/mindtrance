/* Rule-based diagnostic engine. Deterministic: no language model involved.
 * Confidence values are heuristic strengths of evidence, not calibrated probabilities. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});

  const CATEGORIES = {
    CORRECT: { label: 'Correct', blurb: 'The answer matches the verified result.' },
    CARELESS_SLIP: { label: 'Careless slip', blurb: 'The method looks right; a late arithmetic or copying step went wrong. Mastery is not lowered.' },
    UNIT_ERROR: { label: 'Unit error', blurb: 'A unit or prefix was mishandled. This points at unit conversion, not the main concept.' },
    PREREQUISITE_GAP: { label: 'Suspected prerequisite gap', blurb: 'The error pattern points at an upstream concept that the problem depends on.' },
    CONCEPT_MISCONCEPTION: { label: 'Concept misconception', blurb: 'The error pattern points at the target concept itself.' },
  };

  const slipConcept = (track) => (track.concepts.some((c) => c.id === 'unit_conv') ? 'unit_conv' : null);

  /* Compare a student answer with the verified answer and every known error signature. */
  function checkAnswer(problem, answerText) {
    const a = problem.answer;
    if (a.kind === 'expr') {
      if (!MT.expr.exprParses(answerText)) return { ok: false, reason: 'Could not read that as an expression. Use x, + - * / ^, and functions such as sin(x) with brackets.' };
      return {
        ok: true,
        correct: MT.expr.exprEquivalent(answerText, a.expr),
        matchPattern: (pat) => MT.expr.exprEquivalent(answerText, pat.expr),
        value: null,
      };
    }
    const parsed = MT.expr.parseAnswer(answerText);
    if (!parsed.ok) {
      const why = { EMPTY: 'Enter a final answer.', NOT_A_NUMBER: 'Enter a number, optionally followed by a unit (for example 2.5 A).', BAD_UNIT: 'The unit was not recognised.', TOO_LONG: 'That answer is too long.' };
      return { ok: false, reason: why[parsed.reason] || 'Could not read that as a number.' };
    }
    const conv = MT.expr.valueIn(parsed, a.unit);
    if (!conv.ok) return { ok: true, dimension: true, parsed, correct: false, matchPattern: () => false, value: parsed.value };
    const v = conv.value;
    const correct = MT.expr.close(v, a.value, a) || (a.percentOk && !parsed.percent && MT.expr.close(v / 100, a.value, a));
    return { ok: true, parsed, correct, value: v, matchPattern: (pat) => MT.expr.close(v, pat.value, a) };
  }

  function genericSlip(problem, v) {
    const a = problem.answer;
    if (a.kind !== 'number' || a.exact || !Number.isFinite(v) || a.value === 0) return null;
    if (Math.abs(v + a.value) <= Math.abs(a.value) * 1e-3) return { why: 'The magnitude is right but the sign is flipped.', kind: 'slip' };
    const ratio = v / a.value;
    if (ratio > 0) {
      const k = Math.log10(ratio);
      if (Math.abs(k - Math.round(k)) < 1e-3 && Math.round(k) !== 0) {
        return problem.unitSensitive
          ? { why: 'The answer is off by a factor of 10^' + Math.round(k) + ', the signature of a missed prefix or unit conversion.', kind: 'unit' }
          : { why: 'The answer is off by a factor of 10^' + Math.round(k) + ', which looks like a decimal-place slip.', kind: 'slip' };
      }
    }
    const digits = (n) => String(Math.abs(n)).replace(/\D/g, '');
    const da = digits(a.value);
    const dv = digits(v);
    if (da.length > 1 && da !== dv && da.split('').sort().join('') === dv.split('').sort().join('')) return { why: 'The digits are right but in a different order.', kind: 'slip' };
    if (Math.abs(v - a.value) <= Math.abs(a.value) * 0.06) return { why: 'The answer is within a few percent of the verified result, which fits a rounding or arithmetic slip.', kind: 'slip' };
    return null;
  }

  function classify(track, problem, answerText, workingText) {
    const chk = checkAnswer(problem, String(answerText || ''));
    const working = String(workingText || '');
    const base = { engine: 'rule-based', category: null, confidence: 0, evidence: [], hintConcept: null, matchedBy: null };
    if (!chk.ok) return Object.assign(base, { category: 'INVALID_INPUT', reason: chk.reason });
    if (chk.correct) return Object.assign(base, { category: 'CORRECT', confidence: 1, matchedBy: 'verified', evidence: ['The answer was checked against the verified result by deterministic comparison.'] });
    if (chk.dimension) {
      return Object.assign(base, {
        category: 'UNIT_ERROR', confidence: 0.7, matchedBy: 'generic', hintConcept: slipConcept(track),
        evidence: ['The unit "' + chk.parsed.unit + '" does not have the dimension this question asks for.'],
      });
    }

    const keywordHits = (problem.keywords || []).filter((k) => k.re.test(working));
    const sig = (problem.patterns || []).find((p) => chk.matchPattern(p));
    if (sig) {
      const agree = keywordHits.find((k) => k.concept && k.concept === sig.concept);
      const evidence = [sig.evidence];
      if (agree) evidence.push(agree.evidence);
      let category = sig.cat;
      if (sig.concept && sig.concept === track.target && category === 'PREREQUISITE_GAP') category = 'CONCEPT_MISCONCEPTION';
      return Object.assign(base, {
        category, confidence: Math.min(0.95, 0.8 + (agree ? 0.1 : 0)), matchedBy: 'signature',
        evidence, hintConcept: sig.concept || null,
      });
    }

    if (chk.value != null) {
      const gs = genericSlip(problem, chk.value);
      if (gs) {
        return Object.assign(base, {
          category: gs.kind === 'unit' ? 'UNIT_ERROR' : 'CARELESS_SLIP', confidence: 0.6, matchedBy: 'generic',
          hintConcept: gs.kind === 'unit' ? slipConcept(track) : null, evidence: [gs.why],
        });
      }
    }

    if (keywordHits.length) {
      const k = keywordHits[0];
      return Object.assign(base, {
        category: k.cat, confidence: 0.65, matchedBy: 'working', hintConcept: k.concept || null,
        evidence: [k.evidence, 'The final number does not match any known error signature, so this comes from the working steps alone.'],
      });
    }

    const setupHit = (problem.setup || []).some((re) => re.test(working));
    if (setupHit) {
      return Object.assign(base, {
        category: 'CARELESS_SLIP', confidence: 0.5, matchedBy: 'setup',
        evidence: ['The working shows the expected setup, but the final answer is wrong. That fits a late slip rather than a concept gap.'],
      });
    }

    return Object.assign(base, {
      category: 'PREREQUISITE_GAP', confidence: 0.3, matchedBy: 'fallback',
      evidence: ['The answer does not match any known error pattern for this problem. The suspects below are ranked only from the dependency graph and your mastery history, so treat them as weak hypotheses to test.'],
    });
  }

  /* Full diagnosis: classification plus ranked, graph-validated candidate causes. */
  function diagnose(track, problem, answerText, workingText, mastery) {
    const res = classify(track, problem, answerText, workingText);
    res.candidates = [];
    if (res.category !== 'PREREQUISITE_GAP' && res.category !== 'CONCEPT_MISCONCEPTION') return res;
    const gr = MT.graph.build(track);
    const known = (id) => id && gr.byId.has(id);
    const hints = {};
    if (known(res.hintConcept)) hints[res.hintConcept] = res.matchedBy === 'signature' ? 1.0 : 0.6;
    else res.hintConcept = null;
    const ranked = MT.graph.rankSuspects(gr, track.target, mastery || {}, { hints, includeTarget: true });
    const top = ranked.filter((r) => r.score > 0).slice(0, 3);
    res.candidates = top.map((r) => ({ id: r.id, score: r.score, parts: r.parts, fromEvidence: r.parts.hint > 0 }));
    if (res.category === 'PREREQUISITE_GAP' && res.candidates.length && res.candidates[0].id === track.target) res.category = 'CONCEPT_MISCONCEPTION';
    return res;
  }

  MT.diagnose = { CATEGORIES, classify, diagnose, checkAnswer };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.diagnose;
})(typeof window !== 'undefined' ? window : globalThis);
