/* Rule-based diagnostic engine. Deterministic: no language model involved.
 * Evidence strength is a transparent composite of weighted evidence items, not a calibrated probability. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});

  /* The canonical outcome taxonomy. `kind` drives the action policy, not the label:
   *   correct | unverified | gap (needs a lesson) | slip (retry, no mastery change) | partial | language | ambiguous (probe) */
  const OUTCOMES = {
    CORRECT_UNDERSTANDING: { label: 'Correct understanding', kind: 'correct', blurb: 'The answer and the reasoning check out.' },
    CORRECT_ANSWER_UNVERIFIED_REASONING: { label: 'Right answer, reasoning not checked yet', kind: 'unverified', blurb: 'The answer is right, but a right answer alone does not show the idea behind it.' },
    CONCEPTUAL_GAP: { label: 'Conceptual gap', kind: 'gap', recovery: 'full', blurb: 'The error points at the core idea of the target concept itself.' },
    PREREQUISITE_GAP: { label: 'Prerequisite gap', kind: 'gap', recovery: 'full', blurb: 'The setup looks fine; the error points at an upstream concept the problem depends on.' },
    PROCEDURAL_ERROR: { label: 'Procedural error', kind: 'gap', recovery: 'procedural', blurb: 'The right idea and rule were chosen, but a step was applied in the wrong way.' },
    CALCULATION_OR_UNIT_ERROR: { label: 'Calculation or unit slip', kind: 'slip', blurb: 'The setup is sound; an arithmetic step or a unit changed the result. Mastery is not lowered.' },
    READING_OR_INTERPRETATION_ERROR: { label: 'Reading or interpretation slip', kind: 'slip', blurb: 'The work answers a slightly different question than the one asked. Mastery is not lowered.' },
    LANGUAGE_COMPREHENSION_DIFFICULTY: { label: 'Language difficulty', kind: 'language', blurb: 'The wording of the question seems to be the obstacle rather than the subject.' },
    PARTIAL_UNDERSTANDING: { label: 'Partial understanding', kind: 'partial', blurb: 'Part of the idea is there; a secondary part is missing.' },
    POSSIBLE_CARELESS_SLIP: { label: 'Possible slip', kind: 'slip', blurb: 'This looks out of character for what you have shown before. Mastery is not lowered.' },
    AMBIGUOUS_OR_INSUFFICIENT_EVIDENCE: { label: 'Not enough evidence yet', kind: 'ambiguous', blurb: 'More than one explanation fits, so one short question comes before any diagnosis.' },
  };
  const CATEGORIES = OUTCOMES; // original name, still used by the UI

  /* Outcome names used before the spec taxonomy. Saved data from earlier versions is migrated with this. */
  const LEGACY_OUTCOMES = { CARELESS_SLIP: 'POSSIBLE_CARELESS_SLIP', UNIT_ERROR: 'CALCULATION_OR_UNIT_ERROR', CONCEPT_MISCONCEPTION: 'CONCEPTUAL_GAP', CORRECT: 'CORRECT_UNDERSTANDING' };
  const normalizeOutcome = (o) => LEGACY_OUTCOMES[o] || o;
  /* Never throws: an unknown outcome gets a neutral label instead of crashing a page. */
  const outcomeMeta = (o) => OUTCOMES[normalizeOutcome(o)] || { label: String(o || 'Unknown outcome').replace(/_/g, ' ').toLowerCase(), kind: 'other', blurb: '' };

  const kindOf = (outcome) => (OUTCOMES[outcome] ? OUTCOMES[outcome].kind : 'other');
  const needsCandidates = (outcome) => ['gap', 'partial', 'ambiguous'].includes(kindOf(outcome));

  /* Evidence reliability weights and decision thresholds (spec section 9.1). */
  const WEIGHTS = { DETERMINISTIC_STEPS: 0.90, WRITTEN_REASONING: 0.85, PROBE_RESPONSE: 0.75, HISTORY: 0.70, BARE_ANSWER: 0.35, AI_JUDGEMENT: 0.60, RUBRIC: 0.50 };
  const THRESHOLDS = { insufficient: 0.45, confirmed: 0.75 };
  const SOURCE_LABEL = {
    DETERMINISTIC_STEPS: 'Checked step in your working', WRITTEN_REASONING: 'Your written reasoning', PROBE_RESPONSE: 'Answer to a targeted question',
    HISTORY: 'Repeated pattern in your history', BARE_ANSWER: 'Final answer only', AI_JUDGEMENT: 'AI reading of your answer', RUBRIC: 'Demo rubric (keyword rules)',
  };

  /* S_E = 1 - product(1 - w_i * r_i). r_i is how well item i points at the hypothesis. */
  function compositeEvidence(items) {
    return 1 - items.reduce((p, it) => p * (1 - Math.min(1, Math.max(0, it.w * it.r))), 1);
  }
  const tierOf = (score) => (score >= THRESHOLDS.confirmed ? 'CONFIRMED' : score >= THRESHOLDS.insufficient ? 'SUSPECTED' : 'INSUFFICIENT');
  const ev = (source, r, note) => ({ source, w: WEIGHTS[source], r, note: note || '' });

  function withEvidence(res, items) {
    res.evidenceItems = items;
    res.evidenceScore = compositeEvidence(items);
    res.tier = tierOf(res.evidenceScore);
    res.confidence = res.evidenceScore;
    return res;
  }

  /* While evidence is below the threshold, a gap hypothesis is shown as "not enough evidence yet". */
  function effectiveOutcome(res) {
    if (['gap', 'partial'].includes(kindOf(res.category)) && res.tier === 'INSUFFICIENT') return 'AMBIGUOUS_OR_INSUFFICIENT_EVIDENCE';
    return res.category;
  }

  const slipConcept = (track) => (track.concepts.some((c) => c.id === 'unit_conv') ? 'unit_conv' : null);

  /* Compare a student answer with the verified answer and every known error signature. */
  function checkAnswer(problem, answerText) {
    const a = problem.answer;
    if (a.kind === 'choice') {
      const t = String(answerText).trim();
      if (!/^[0-2]$/.test(t)) return { ok: false, reason: 'Choose one of the options.' };
      return { ok: true, correct: Number(t) === a.correct, matchPattern: () => false, value: null };
    }
    if (a.kind === 'open') {
      const t = String(answerText).trim();
      if (t.length < 3) return { ok: false, reason: 'Write an answer in your own words.' };
      if (t.length > 1500) return { ok: false, reason: 'That answer is too long. Keep it under 1500 characters.' };
      return { ok: true, open: true, correct: false, matchPattern: () => false, value: null };
    }
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

  function classify(track, problem, answerText, workingText, ctx) {
    const c = ctx || {};
    const chk = checkAnswer(problem, String(answerText || ''));
    const working = String(workingText || '');
    const base = { engine: 'rule-based', category: null, confidence: 0, evidence: [], hintConcept: null, matchedBy: null };
    const slipOutcome = () => (c.mastery && c.mastery[track.target] > 0.8 ? 'POSSIBLE_CARELESS_SLIP' : 'CALCULATION_OR_UNIT_ERROR');
    const history = (concept) => (concept && c.priorGaps && c.priorGaps[concept] >= 2 ? [ev('HISTORY', 1, 'The same concept was implicated in earlier attempts.')] : []);
    if (!chk.ok) return Object.assign(base, { category: 'INVALID_INPUT', reason: chk.reason });
    if (chk.open) {
      // Open-ended answers have no deterministic checker: the caller must supply a judgement (AI or demo rubric).
      return withEvidence(Object.assign(base, { category: 'AMBIGUOUS_OR_INSUFFICIENT_EVIDENCE', matchedBy: 'fallback', needsJudge: true, evidence: ['This open-ended answer needs a judgement before it can be diagnosed.'] }), []);
    }
    if (chk.correct) {
      return withEvidence(Object.assign(base, { category: 'CORRECT_UNDERSTANDING', matchedBy: 'verified', evidence: ['The answer was checked against the verified result by deterministic comparison.'] }), [ev('DETERMINISTIC_STEPS', 1, 'Deterministic comparison with the verified result.')]);
    }
    if (problem.answer.kind === 'choice') {
      return withEvidence(Object.assign(base, {
        category: 'PREREQUISITE_GAP', matchedBy: 'choice', hintConcept: problem.concept || null,
        evidence: ['A wrong option was chosen on a question that tests this concept.'],
      }), [ev('PROBE_RESPONSE', 1, 'A targeted question on this concept was missed.')]);
    }
    if (chk.dimension) {
      return withEvidence(Object.assign(base, {
        category: 'CALCULATION_OR_UNIT_ERROR', matchedBy: 'generic', hintConcept: slipConcept(track),
        evidence: ['The unit "' + chk.parsed.unit + '" does not have the dimension this question asks for.'],
      }), [ev('DETERMINISTIC_STEPS', 0.8, 'The unit parser found a dimension mismatch.')]);
    }

    const keywordHits = (problem.keywords || []).filter((k) => k.re.test(working));
    const sig = (problem.patterns || []).find((p) => chk.matchPattern(p));
    if (sig) {
      const agree = keywordHits.find((k) => k.concept && k.concept === sig.concept);
      const evidence = [sig.evidence];
      const items = [ev('BARE_ANSWER', 1, 'The final answer matches a known wrong-answer pattern.')];
      if (agree) { evidence.push(agree.evidence); items.push(ev('DETERMINISTIC_STEPS', 1, 'A step in your working shows the same error.')); }
      else if (working.trim().length >= 10) items.push(ev('WRITTEN_REASONING', 0.3, 'Working was shown, but no step confirms the hypothesis by itself.'));
      items.push(...history(sig.concept));
      let category = sig.cat;
      if (sig.concept && sig.concept === track.target && category === 'PREREQUISITE_GAP') category = 'CONCEPTUAL_GAP';
      return withEvidence(Object.assign(base, { category, matchedBy: 'signature', evidence, hintConcept: sig.concept || null }), items);
    }

    if (chk.value != null) {
      const gs = genericSlip(problem, chk.value);
      if (gs) {
        return withEvidence(Object.assign(base, {
          category: gs.kind === 'unit' ? 'CALCULATION_OR_UNIT_ERROR' : slipOutcome(), matchedBy: 'generic',
          hintConcept: gs.kind === 'unit' ? slipConcept(track) : null, evidence: [gs.why],
        }), [ev('BARE_ANSWER', 0.8, gs.why)]);
      }
    }

    if (keywordHits.length) {
      const k = keywordHits[0];
      return withEvidence(Object.assign(base, {
        category: k.cat, matchedBy: 'working', hintConcept: k.concept || null,
        evidence: [k.evidence, 'The final number does not match any known error signature, so this comes from the working steps alone.'],
      }), [ev('DETERMINISTIC_STEPS', 0.8, 'A step in your working matches a known error.'), ...history(k.concept)]);
    }

    const setupHit = (problem.setup || []).some((re) => re.test(working));
    if (setupHit) {
      return withEvidence(Object.assign(base, {
        category: slipOutcome(), matchedBy: 'setup',
        evidence: ['The working shows the expected setup, but the final answer is wrong. That fits a late slip rather than a concept gap.'],
      }), [ev('WRITTEN_REASONING', 0.6, 'The working shows a sound setup.')]);
    }

    return withEvidence(Object.assign(base, {
      category: 'AMBIGUOUS_OR_INSUFFICIENT_EVIDENCE', matchedBy: 'fallback',
      evidence: ['The answer does not match any known error pattern for this problem. The suspects below are ranked only from the dependency graph and your mastery history, so treat them as weak hypotheses to test.'],
    }), [ev('BARE_ANSWER', 0.2, 'Only a final answer, with no recognisable pattern.')]);
  }

  /* Full diagnosis: classification plus ranked, graph-validated candidate causes.
   * ctx.priorGaps maps concept id to how often it was implicated before (cross-session history). */
  function diagnose(track, problem, answerText, workingText, mastery, ctx) {
    const res = classify(track, problem, answerText, workingText, Object.assign({ mastery }, ctx || {}));
    res.candidates = [];
    if (!needsCandidates(res.category)) return res;
    const gr = MT.graph.build(track);
    const known = (id) => id && gr.byId.has(id);
    const hints = {};
    if (known(res.hintConcept)) hints[res.hintConcept] = res.matchedBy === 'signature' ? 1.0 : 0.6;
    else res.hintConcept = null;
    const ranked = MT.graph.rankSuspects(gr, track.target, mastery || {}, { hints, includeTarget: true });
    const top = ranked.filter((r) => r.score > 0).slice(0, 3);
    res.candidates = top.map((r) => ({ id: r.id, score: r.score, parts: r.parts, fromEvidence: r.parts.hint > 0 }));
    if (res.category === 'PREREQUISITE_GAP' && res.candidates.length && res.candidates[0].id === track.target) res.category = 'CONCEPTUAL_GAP';
    return res;
  }

  MT.diagnose = { CATEGORIES, OUTCOMES, LEGACY_OUTCOMES, normalizeOutcome, outcomeMeta, WEIGHTS, THRESHOLDS, SOURCE_LABEL, kindOf, needsCandidates, compositeEvidence, tierOf, withEvidence, effectiveOutcome, classify, diagnose, checkAnswer };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.diagnose;
})(typeof window !== 'undefined' ? window : globalThis);
