/* Session orchestration: attempt -> diagnosis -> probe -> recovery -> verification.
 * Every state change goes through MT.machine; every mastery change goes through the store. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});

  const ORIGINAL_SEED = 1;
  const MAX_PROBES = 2; // spec: at most two diagnostic probes per question
  const MAX_RECOVERY_LOOPS = 2;

  const trackOf = (s) => MT.data.track(s.trackId);
  const conceptOf = (track, id) => track.concepts.find((c) => c.id === id);

  function originalProblem(session) {
    const track = trackOf(session);
    const def = track.problems.find((p) => p.id === session.problemId) || track.problems[0];
    return MT.data.instantiate(def, ORIGINAL_SEED);
  }

  function verificationProblem(session) {
    const v = session.verification;
    if (!v) return null;
    const track = trackOf(session);
    return MT.data.instantiate(track.verification.find((t) => t.id === v.defId), v.seed);
  }

  /* Deterministic option shuffle so the correct answer is not always first. */
  function presentMCQ(q, salt) {
    let h = 2166136261;
    for (const ch of String(salt)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const rng = MT.rng.create(h >>> 0);
    const order = q.options.map((text, i) => ({ text, i }));
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return { q: q.q, options: order.map((o) => ({ text: o.text, index: o.i })) };
  }

  /* Confirmed-gap ancestors that must be repaired before the original problem is attempted. */
  function lockedBy(store, trackId, problemId) {
    const track = MT.data.track(trackId);
    const def = track.problems.find((p) => p.id === problemId) || track.problems[0];
    const gr = MT.graph.build(track);
    // The underlying gap, not the display status: the lock must hold while the student is mid-recovery.
    return MT.graph.blockedBy(gr, def.target, (id) => store.isGap(trackId, id));
  }

  function startSession(store, trackId, problemId) {
    const existing = store.activeFor(trackId, problemId);
    if (existing) return existing;
    return store.newSession({ trackId, problemId, seed: ORIGINAL_SEED, attemptCount: 0, history: [] });
  }

  /* Open (or resume) a recovery session for a concept straight from the knowledge map. */
  function startRecoveryFor(store, trackId, conceptId) {
    const track = MT.data.track(trackId);
    const problemId = track.problems[0].id;
    let s = store.sessionList().find((x) => x.trackId === trackId && !x.closed && x.gap && x.gap.conceptId === conceptId && ['RECOVERY_IN_PROGRESS', 'VERIFICATION_REQUIRED'].includes(x.state));
    if (s) return s;
    s = store.newSession({ trackId, problemId, seed: ORIGINAL_SEED, attemptCount: 0, history: [], fromMap: true });
    const c = store.conceptState(trackId, conceptId);
    s.gap = { conceptId, p: c.p, evidence: [], fromMap: true };
    MT.machine.transition(s, 'RECOVERY_REQUIRED', 'started from knowledge map', store.now());
    store.touch(s);
    return beginRecovery(store, s.id);
  }

  /* How often each concept was implicated in earlier gap attempts on this track (cross-session history). */
  function priorGapCounts(store, trackId) {
    const out = {};
    for (const e of store.events()) {
      if (e.type === 'ATTEMPT' && e.trackId === trackId && !e.correct && e.conceptId && ['gap', 'partial'].includes(MT.diagnose.kindOf(e.category))) out[e.conceptId] = (out[e.conceptId] || 0) + 1;
    }
    return out;
  }

  function logEvent(store, session, type, extra) {
    store.addEvent(Object.assign({ type, trackId: session.trackId, sessionId: session.id, problemId: session.problemId }, extra));
    store.commit();
  }

  function submitAttempt(store, sessionId, answer, working, opts) {
    const s = store.getSession(sessionId);
    if (!s) return { ok: false, error: 'Session not found.' };
    if (s.state !== 'READY') return { ok: false, error: 'This session is not ready for a new attempt.' };
    const track = trackOf(s);
    const problem = originalProblem(s);
    const locked = lockedBy(store, s.trackId, s.problemId);
    if (locked.length) return { ok: false, locked, error: 'Recover the confirmed gap first.' };

    const mastery = store.masteryMap(s.trackId);
    let res = MT.diagnose.diagnose(track, problem, answer, working, mastery, { priorGaps: priorGapCounts(store, s.trackId) });
    if (res.category === 'INVALID_INPUT') return { ok: false, error: res.reason };

    if (problem.answer.kind === 'open') {
      // No deterministic checker exists for open-ended answers: the judgement (AI or demo rubric) decides, and says so.
      const j = opts && opts.judgement;
      if (!j) return { ok: false, error: 'This answer needs a judgement before it can be diagnosed.' };
      if (j.isCorrect) res = { engine: j.engine, category: 'CORRECT_UNDERSTANDING', confidence: j.confidence, evidence: j.evidence, matchedBy: j.matchedBy || 'ai', hintConcept: null, candidates: [] };
      else res = applyOverride(track, res, j, mastery);
      res.judged = true;
      attachRubric(res, j);
    }

    const override = opts && opts.override;
    if (override && res.matchedBy === 'fallback' && res.category !== 'CORRECT_UNDERSTANDING') res = applyOverride(track, res, override, mastery);

    const now = store.now();
    MT.machine.transition(s, 'ATTEMPT_SUBMITTED', 'attempt ' + (s.attemptCount + 1), now);
    s.attemptCount += 1;
    s.attempt = { answer: String(answer), working: String(working || ''), at: now };

    // A right answer on an open question with no working shown does not yet show the idea behind it.
    if (res.category === 'CORRECT_UNDERSTANDING' && problem.answer.kind === 'open' && !String(working || '').trim() && String(answer).trim().length < 60 && !(opts && opts.skipReasoningCheck)) {
      MT.machine.transition(s, 'REASONING_CHECK', 'right answer, reasoning not shown', now);
      s.diagnosis = Object.assign({}, res, { category: 'CORRECT_ANSWER_UNVERIFIED_REASONING', tier: 'SUSPECTED' });
      logEvent(store, s, 'ATTEMPT', { category: 'CORRECT_ANSWER_UNVERIFIED_REASONING', correct: false, conceptId: null, matchedBy: res.matchedBy, mode: opts && opts.mode });
      store.touch(s);
      return { ok: true, session: s, diagnosis: s.diagnosis };
    }
    return settle(store, s, res, track, problem, now, opts && opts.mode);
  }

  /* Open-ended work is scored on a rubric, not as a right-or-wrong observation (spec 11.2). */
  function attachRubric(res, j) {
    res.rubricScore = typeof j.rubricScore === 'number' ? j.rubricScore : (j.isCorrect ? 0.85 : 0.35);
    res.rubricWeight = 0.5 + 0.5 * Math.min(1, Math.max(0, j.confidence || 0));
  }

  /* Everything that happens once an attempt has a classification: mastery, routing, probes. */
  function settle(store, s, res, track, problem, now, mode) {
    if (res.category === 'CORRECT_UNDERSTANDING') {
      MT.machine.transition(s, 'ATTEMPT_CORRECT', 'verified correct', now);
      s.diagnosis = res;
      s.result = { ...(s.result || {}), solved: true };
      logEvent(store, s, 'ATTEMPT', { category: 'CORRECT_UNDERSTANDING', correct: true, mode });
      const o = res.rubricScore != null
        ? store.rubric(s.trackId, track.target, res.rubricScore, res.rubricWeight, { sessionId: s.id, problemId: s.problemId, source: 'attempt' })
        : store.observe(s.trackId, track.target, true, { sessionId: s.id, problemId: s.problemId, source: 'attempt', bkt: ctxParams(store, 'attempt', problem) });
      s.result.targetBefore = o.before;
      s.result.targetAfter = o.after;
      store.touch(s);
      return { ok: true, session: s, diagnosis: res };
    }

    MT.machine.transition(s, 'ERROR_CLASSIFIED', res.category, now);
    s.diagnosis = res;
    s.probeIndex = 0;
    logEvent(store, s, 'ATTEMPT', { category: res.category, tier: res.tier, correct: false, conceptId: res.hintConcept || null, matchedBy: res.matchedBy, mode });

    if (res.rubricScore != null && ['gap', 'partial', 'ambiguous'].includes(MT.diagnose.kindOf(res.category))) {
      store.rubric(s.trackId, track.target, res.rubricScore, res.rubricWeight, { sessionId: s.id, problemId: s.problemId, source: 'attempt' });
    }

    let candidates = res.candidates || [];
    if (res.category === 'CALCULATION_OR_UNIT_ERROR' && res.hintConcept) {
      const priorUnit = store.events().filter((e) => e.type === 'ATTEMPT' && e.category === 'CALCULATION_OR_UNIT_ERROR' && e.trackId === s.trackId && e.sessionId !== s.id).length;
      const sameSession = store.events().filter((e) => e.type === 'ATTEMPT' && e.category === 'CALCULATION_OR_UNIT_ERROR' && e.sessionId === s.id).length;
      if (priorUnit + sameSession >= 2) {
        candidates = [{ id: res.hintConcept, score: 1, parts: {}, fromEvidence: true }];
        res.escalated = true;
      }
    }
    res.candidates = candidates;

    // Strong evidence (S_E >= 0.75, e.g. the working shows the exact error) needs no extra question.
    if (MT.diagnose.kindOf(res.category) === 'gap' && res.tier === 'CONFIRMED' && res.hintConcept && candidates.length) {
      const cid = res.hintConcept;
      if (MT.bkt.observe(store.p(s.trackId, cid), false, ctxParams(store, 'attempt', problem)).after < MT.bkt.DEFAULTS.gapBelow) {
        const o = store.observe(s.trackId, cid, false, { sessionId: s.id, problemId: s.problemId, source: 'attempt-evidence', bkt: ctxParams(store, 'attempt', problem) });
        s.gap = { conceptId: cid, p: o.after, evidence: res.evidence.slice(), misconception: conceptOf(track, cid).lesson.misconception, outcome: res.category, confirmedBy: 'evidence' };
        MT.machine.transition(s, 'GAP_CONFIRMED', 'evidence ' + Math.round(res.evidenceScore * 100) + '%', now);
        store.touch(s);
        return { ok: true, session: s, diagnosis: res };
      }
    }

    if (candidates.length) {
      MT.machine.transition(s, 'PROBE_REQUIRED', 'probe ' + candidates[0].id, now);
    } else {
      MT.machine.transition(s, 'RETRY_REQUIRED', MT.diagnose.kindOf(res.category) === 'slip' ? 'slip: no mastery change' : 'no probe needed', now);
    }
    store.touch(s);
    return { ok: true, session: s, diagnosis: res };
  }

  /* Context-adjusted BKT parameters (spec 11.1): slip is higher after a calculation slip, guess depends on the answer format. */
  function ctxParams(store, source, problem) {
    const out = {};
    if (source === 'probe' || source === 'practice' || source === 'verification-choice') out.pGuess = 1 / 3; // three-option multiple choice
    else if (problem && problem.answer && problem.answer.kind === 'choice') out.pGuess = 1 / 3;
    else out.pGuess = 0.05; // typed numeric or expression answer
    return out;
  }

  /* Optional AI classification (already schema-validated by ai.js) replaces only a fallback result. */
  function applyOverride(track, res, ov, mastery) {
    const gr = MT.graph.build(track);
    const out = Object.assign({}, res, {
      engine: ov.engine || 'gemini', category: ov.category, evidence: ov.evidence, matchedBy: ov.matchedBy || 'ai',
      hintConcept: gr.byId.has(ov.hintConcept) ? ov.hintConcept : null,
    });
    MT.diagnose.withEvidence(out, [{ source: out.engine === 'demo-rubric' ? 'RUBRIC' : 'AI_JUDGEMENT', w: MT.diagnose.WEIGHTS[out.engine === 'demo-rubric' ? 'RUBRIC' : 'AI_JUDGEMENT'], r: ov.confidence, note: 'Judgement of your written answer.' }]);
    if (MT.diagnose.needsCandidates(out.category)) {
      const hints = out.hintConcept ? { [out.hintConcept]: 0.8 } : {};
      const ranked = MT.graph.rankSuspects(gr, track.target, mastery, { hints, includeTarget: true }).filter((r) => r.score > 0).slice(0, 3);
      out.candidates = ranked.map((r) => ({ id: r.id, score: r.score, parts: r.parts, fromEvidence: r.parts.hint > 0 }));
    } else out.candidates = [];
    return out;
  }

  function currentProbe(session) {
    if (session.state !== 'PROBE_REQUIRED' || !session.diagnosis) return null;
    const cand = session.diagnosis.candidates[session.probeIndex];
    if (!cand) return null;
    const track = trackOf(session);
    const concept = conceptOf(track, cand.id);
    return { concept, candidate: cand, mcq: presentMCQ(concept.probe, session.id + ':' + cand.id), number: session.probeIndex + 1, total: Math.min(MAX_PROBES, session.diagnosis.candidates.length) };
  }

  function answerProbe(store, sessionId, optionIndex) {
    const s = store.getSession(sessionId);
    const probe = s && currentProbe(s);
    if (!probe) return { ok: false, error: 'There is no active probe.' };
    const correct = optionIndex === probe.concept.probe.correct;
    const now = store.now();
    const o = store.observe(s.trackId, probe.concept.id, correct, { sessionId: s.id, problemId: s.problemId, source: 'probe', bkt: ctxParams(store, 'probe') });
    const entry = { conceptId: probe.concept.id, correct, before: o.before, after: o.after };
    s.probes.push(entry);
    const advance = (note) => {
      if (s.probeIndex + 1 < Math.min(MAX_PROBES, s.diagnosis.candidates.length)) {
        s.probeIndex += 1;
        MT.machine.transition(s, 'PROBE_REQUIRED', note, now);
        return 'NEXT_PROBE';
      }
      escalate(store, s, 'probes');
      return 'ESCALATED';
    };
    let outcome;
    if (!correct && o.after < MT.bkt.DEFAULTS.gapBelow) {
      s.gap = { conceptId: probe.concept.id, p: o.after, evidence: s.diagnosis.evidence.slice(), misconception: probe.concept.lesson.misconception, outcome: s.diagnosis.category, confirmedBy: 'probe' };
      MT.machine.transition(s, 'GAP_CONFIRMED', probe.concept.id, now);
      outcome = 'GAP_CONFIRMED';
    } else if (!correct) {
      entry.inconclusive = true;
      outcome = advance('probe failed but evidence still weak');
    } else {
      outcome = advance('probe passed, hypothesis rejected');
    }
    entry.outcome = outcome;
    store.touch(s);
    return { ok: true, session: s, correct, outcome, entry };
  }

  /* After two probes or two failed recoveries, stop questioning: give the worked solution and flag the concepts for review. */
  function escalate(store, s, reason) {
    const track = trackOf(s);
    const problem = originalProblem(s);
    const ids = reason === 'recovery' ? [s.gap.conceptId] : ((s.diagnosis && s.diagnosis.candidates) || []).slice(0, MAX_PROBES).map((c) => c.id);
    MT.machine.transition(s, 'ESCALATED_TO_SOLUTION', reason === 'recovery' ? 'two recovery cycles without verification' : 'two probes without a confirmed cause', store.now());
    s.escalation = { reason, concepts: ids, solution: (problem.solution || []).slice() };
    for (const id of ids) store.scheduleReview(s.trackId, id, 'escalated', 2);
    logEvent(store, s, 'ESCALATED', { reason, conceptId: ids[0] || null });
    store.touch(s);
    void track;
  }

  function beginRecovery(store, sessionId) {
    const s = store.getSession(sessionId);
    if (!s) return null;
    const now = store.now();
    if (s.state === 'GAP_CONFIRMED') MT.machine.transition(s, 'RECOVERY_REQUIRED', 'start recovery', now);
    if (s.state === 'RECOVERY_REQUIRED') {
      MT.machine.transition(s, 'RECOVERY_IN_PROGRESS', 'lesson opened', now);
      s.recovery = { conceptId: s.gap.conceptId, step: 'lesson', learned: false, practiceDone: false, practiceTries: 0 };
      logEvent(store, s, 'RECOVERY_STARTED', { conceptId: s.gap.conceptId });
    }
    store.touch(s);
    return s;
  }

  /* The learning transition happens exactly once, when the lesson has been delivered. */
  function completeLesson(store, sessionId) {
    const s = store.getSession(sessionId);
    if (!s || s.state !== 'RECOVERY_IN_PROGRESS' || s.recovery.step !== 'lesson') return { ok: false, error: 'No lesson in progress.' };
    const r = store.learn(s.trackId, s.recovery.conceptId, { sessionId: s.id, source: 'lesson', bkt: { pTransit: 0.30 } });
    s.recovery.learned = true;
    s.recovery.step = 'practice';
    s.recovery.afterLesson = r.after;
    store.touch(s);
    return { ok: true, session: s, learn: r };
  }

  function currentPractice(session) {
    if (session.state !== 'RECOVERY_IN_PROGRESS' || !session.recovery || session.recovery.step === 'lesson') return null;
    const concept = conceptOf(trackOf(session), session.recovery.conceptId);
    return { concept, mcq: presentMCQ(concept.practice, session.id + ':practice:' + session.recovery.practiceTries) };
  }

  function answerPractice(store, sessionId, optionIndex) {
    const s = store.getSession(sessionId);
    const pr = s && currentPractice(s);
    if (!pr || s.recovery.practiceDone) return { ok: false, error: 'No practice question is active.' };
    const correct = optionIndex === pr.concept.practice.correct;
    const o = store.observe(s.trackId, pr.concept.id, correct, { sessionId: s.id, source: 'practice', bkt: ctxParams(store, 'practice') });
    s.recovery.practiceTries += 1;
    if (correct) { s.recovery.practiceDone = true; s.recovery.step = 'done'; }
    store.touch(s);
    return { ok: true, session: s, correct, feedback: pr.concept.practice.feedback, observation: o };
  }

  function pickVerification(store, session) {
    const track = trackOf(session);
    const n = session.verification ? session.verification.issued : 0;
    // Prefer a question that tests the concept being recovered (custom tracks tag each one).
    const gapId = session.gap && session.gap.conceptId;
    const tagged = track.verification.filter((t) => t.concept);
    let pool = track.verification;
    if (tagged.length) {
      pool = tagged.filter((t) => t.concept === gapId);
      if (!pool.length) pool = tagged.filter((t) => t.concept === track.target);
      if (!pool.length) pool = tagged;
    }
    const def = pool[n % pool.length];
    const original = originalProblem(session).statement;
    let seed = (store.now() % 100000) + n * 7919;
    let tries = 0;
    while (MT.data.instantiate(def, seed).statement === original && tries++ < 20) seed += 13;
    return { defId: def.id, seed };
  }

  function startVerification(store, sessionId) {
    const s = store.getSession(sessionId);
    if (!s || s.state !== 'RECOVERY_IN_PROGRESS' || !s.recovery.practiceDone) return { ok: false, error: 'Finish the practice question first.' };
    const pick = pickVerification(store, s);
    s.verification = { defId: pick.defId, seed: pick.seed, issued: 1, attempts: [], pEntry: store.p(s.trackId, s.gap.conceptId) };
    MT.machine.transition(s, 'VERIFICATION_REQUIRED', 'fresh problem ' + pick.defId, store.now());
    store.touch(s);
    return { ok: true, session: s };
  }

  function submitVerification(store, sessionId, answer, working) {
    const s = store.getSession(sessionId);
    if (!s || s.state !== 'VERIFICATION_REQUIRED') return { ok: false, error: 'No verification problem is active.' };
    const track = trackOf(s);
    const vp = verificationProblem(s);
    const res = MT.diagnose.classify(track, vp, answer, working);
    if (res.category === 'INVALID_INPUT') return { ok: false, error: res.reason };
    const gapId = s.gap.conceptId;
    const now = store.now();
    const attempt = { answer: String(answer), category: res.category, at: now, problemSeed: s.verification.seed };
    s.verification.attempts.push(attempt);

    if (res.category === 'CORRECT_UNDERSTANDING') {
      const before = store.p(s.trackId, gapId);
      const vParams = ctxParams(store, vp.answer.kind === 'choice' ? 'verification-choice' : 'verification', vp);
      const o = store.observe(s.trackId, gapId, true, { sessionId: s.id, source: 'verification', bkt: vParams });
      if (gapId !== track.target) store.observe(s.trackId, track.target, true, { sessionId: s.id, source: 'verification-transfer', bkt: vParams });
      attempt.after = o.after;
      if (o.after >= MT.bkt.DEFAULTS.masteredAt) {
        MT.machine.transition(s, 'MASTERY_VERIFIED', 'verified', now);
        s.result = Object.assign(s.result || {}, { verified: true, conceptId: gapId, before: s.verification.pEntry, after: o.after });
        logEvent(store, s, 'MASTERY_VERIFIED', { conceptId: gapId, before, after: o.after });
        const rev = store.noteVerified(s.trackId, gapId);
        s.result.reviewDueAt = rev.dueAt;
        store.touch(s);
        return { ok: true, session: s, outcome: 'VERIFIED', diagnosis: res, before, after: o.after };
      }
      s.verification.issued += 1;
      const pick = pickVerification(store, s);
      s.verification.defId = pick.defId; s.verification.seed = pick.seed;
      store.touch(s);
      return { ok: true, session: s, outcome: 'NEEDS_MORE', diagnosis: res, before, after: o.after };
    }

    const implicated = res.hintConcept === gapId && (res.category === 'PREREQUISITE_GAP' || res.category === 'CONCEPTUAL_GAP' || res.category === 'CALCULATION_OR_UNIT_ERROR');
    if (implicated) {
      const o = store.observe(s.trackId, gapId, false, { sessionId: s.id, source: 'verification', bkt: ctxParams(store, vp.answer.kind === 'choice' ? 'verification-choice' : 'verification', vp) });
      attempt.after = o.after;
      s.gap.p = o.after;
      s.recovery = null;
      s.recoveryLoops = (s.recoveryLoops || 0) + 1;
      logEvent(store, s, 'VERIFICATION_FAILED', { conceptId: gapId, before: o.before, after: o.after });
      if (s.recoveryLoops >= MAX_RECOVERY_LOOPS) {
        s.diagnosis = s.diagnosis || { candidates: [{ id: gapId }] };
        escalate(store, s, 'recovery');
        return { ok: true, session: s, outcome: 'ESCALATED', diagnosis: res };
      }
      MT.machine.transition(s, 'RECOVERY_REQUIRED', 'verification failed on the same concept', now);
      store.touch(s);
      return { ok: true, session: s, outcome: 'SAME_GAP', diagnosis: res };
    }
    // Different or unclear error: no mastery penalty on the recovered concept; give a fresh problem.
    s.verification.issued += 1;
    const pick = pickVerification(store, s);
    s.verification.defId = pick.defId; s.verification.seed = pick.seed;
    store.touch(s);
    return { ok: true, session: s, outcome: 'OTHER_ERROR', diagnosis: res };
  }

  function tryAgain(store, sessionId) {
    const s = store.getSession(sessionId);
    if (!s) return null;
    const now = store.now();
    if (s.state === 'MASTERY_VERIFIED') MT.machine.transition(s, 'RETRY_REQUIRED', 'retry original', now);
    if (s.state === 'ESCALATED_TO_SOLUTION' || s.state === 'DIRECT_EXPLANATION') MT.machine.transition(s, 'READY', 'back to the problem', now);
    if (s.state === 'ATTEMPT_CORRECT' || s.state === 'RETRY_REQUIRED') MT.machine.transition(s, 'READY', 'new attempt', now);
    if (s.state === 'READY') {
      if (s.attempt) s.history.push({ attempt: s.attempt, category: s.diagnosis && s.diagnosis.category });
      s.attempt = null; s.diagnosis = null; s.probes = []; s.probeIndex = 0; s.gap = null; s.recovery = null; s.verification = null; s.escalation = null; s.recoveryLoops = 0; s.explain = null;
      s.result = Object.assign({}, s.result, { solved: false });
    }
    store.touch(s);
    return s;
  }

  /* ---------- learning modes (spec 4, stage 1) ---------- */
  const MODES = [
    { id: 'SOLVE_WITH_ME', label: 'Solve with me', hint: 'Attempt it; I diagnose what is missing.', attempt: true },
    { id: 'CHECK_ANSWER', label: 'Check my answer', hint: 'Tell me if I am right, and why not if I am not.', attempt: true },
    { id: 'DIAGNOSE_MISTAKE', label: 'Why do I keep getting this wrong?', hint: 'Look at my history on this concept too.', attempt: true },
    { id: 'GIVE_HINT', label: 'Give me a hint', hint: 'A nudge, no answer, no penalty.', attempt: false },
    { id: 'EXPLAIN_CONCEPT', label: 'Explain this concept', hint: 'Skip the questions and explain it.', attempt: false },
    { id: 'TEACH_FROM_BASICS', label: 'Teach me from the basics', hint: 'Start at the foundations and build up.', attempt: false },
    { id: 'EXAM_PREP', label: 'Exam prep', hint: 'Same checks, framed as exam practice.', attempt: true },
  ];

  /* Three progressive hints from the concept most likely to be the obstacle. No state change and no mastery change. */
  function getHint(store, trackId, problemId, level) {
    const track = MT.data.track(trackId);
    const def = track.problems.find((p) => p.id === problemId) || track.problems[0];
    const gr = MT.graph.build(track);
    const ranked = MT.graph.rankSuspects(gr, def.target, store.masteryMap(trackId), { includeTarget: true });
    const concept = conceptOf(track, ranked.length ? ranked[0].id : def.target);
    const L = Math.min(3, Math.max(1, level));
    const text = L === 1 ? 'Think about: ' + concept.name + '. ' + concept.lesson.why
      : L === 2 ? 'A worked example of the idea. ' + concept.lesson.example.q + ' ' + concept.lesson.example.a
        : 'The idea in short: ' + concept.lesson.explain;
    store.addEvent({ type: 'HINT', trackId, problemId, conceptId: concept.id, level: L });
    store.commit();
    return { level: L, max: 3, concept, text };
  }

  /* Direct explanation with an optional quick check. TEACH_FROM_BASICS walks the prerequisites in dependency order. */
  function startExplanation(store, sessionId, mode) {
    const s = store.getSession(sessionId);
    if (!s || s.state !== 'READY') return { ok: false, error: 'Finish the current step first.' };
    const track = trackOf(s);
    const def = track.problems.find((p) => p.id === s.problemId) || track.problems[0];
    const gr = MT.graph.build(track);
    let ids = [def.target];
    if (mode === 'TEACH_FROM_BASICS') {
      const need = new Set([def.target, ...MT.graph.ancestors(gr, def.target).keys()]);
      ids = MT.graph.topoOrder(gr).filter((id) => need.has(id));
    }
    MT.machine.transition(s, 'DIRECT_EXPLANATION', mode, store.now());
    s.explain = { mode, concepts: ids, checkDone: false };
    store.addEvent({ type: 'EXPLANATION', trackId: s.trackId, sessionId: s.id, problemId: s.problemId, conceptId: def.target, mode });
    store.touch(s);
    return { ok: true, session: s };
  }

  function currentExplainCheck(session) {
    if (session.state !== 'DIRECT_EXPLANATION' || !session.explain) return null;
    const track = trackOf(session);
    const concept = conceptOf(track, session.explain.concepts[session.explain.concepts.length - 1]);
    return { concept, mcq: presentMCQ(concept.practice, session.id + ':explain:' + (session.explain.tries || 0)) };
  }

  function answerExplainCheck(store, sessionId, optionIndex) {
    const s = store.getSession(sessionId);
    const chk = s && currentExplainCheck(s);
    if (!chk) return { ok: false, error: 'There is no quick check.' };
    const correct = optionIndex === chk.concept.practice.correct;
    const o = store.observe(s.trackId, chk.concept.id, correct, { sessionId: s.id, source: 'explain-check', bkt: ctxParams(store, 'practice') });
    s.explain.tries = (s.explain.tries || 0) + 1;
    if (correct) s.explain.checkDone = true;
    store.touch(s);
    return { ok: true, session: s, correct, feedback: chk.concept.practice.feedback, observation: o };
  }

  /* The student explains their reasoning after a right answer; the judgement of answer plus reasoning settles it. */
  function submitReasoning(store, sessionId, reasoning, judgement) {
    const s = store.getSession(sessionId);
    if (!s || s.state !== 'REASONING_CHECK') return { ok: false, error: 'No reasoning check is waiting.' };
    const text = String(reasoning || '').trim();
    if (text.length < 8) return { ok: false, error: 'Write a sentence or two about how you got there.' };
    if (!judgement) return { ok: false, error: 'This needs a judgement before it can be settled.' };
    const track = trackOf(s);
    const problem = originalProblem(s);
    s.attempt.working = text;
    const mastery = store.masteryMap(s.trackId);
    let res;
    if (judgement.isCorrect) res = { engine: judgement.engine, category: 'CORRECT_UNDERSTANDING', confidence: judgement.confidence, evidence: judgement.evidence, matchedBy: judgement.matchedBy || 'ai', hintConcept: null, candidates: [], judged: true };
    else {
      const base = MT.diagnose.classify(track, problem, s.attempt.answer, text, { mastery });
      res = applyOverride(track, base, judgement, mastery);
      res.judged = true;
    }
    attachRubric(res, judgement);
    return settle(store, s, res, track, problem, store.now(), 'reasoning');
  }

  /* What the student should do next, for the dashboard. */
  function nextAction(store) {
    const open = store.sessionList().find((s) => !s.closed && !['READY', 'ATTEMPT_CORRECT', 'MASTERY_VERIFIED', 'ESCALATED_TO_SOLUTION'].includes(s.state));
    if (open) return { kind: 'continue', session: open };
    const focus = store.settings().examFocus;
    const ordered = MT.data.tracks.slice().sort((a, b) => (b.domainId === focus) - (a.domainId === focus));
    for (const track of ordered) {
      const gs = store.graphState(track.id);
      const gap = track.concepts.filter((c) => gs[c.id].status === 'CONFIRMED_GAP').sort((a, b) => gs[a.id].p - gs[b.id].p)[0];
      if (gap) return { kind: 'recover', trackId: track.id, conceptId: gap.id };
    }
    const due = store.dueReviews()[0];
    if (due) return { kind: 'review', trackId: due.trackId, conceptId: due.conceptId, reason: due.reason };
    const tried = new Set(store.sessionList().map((s) => s.trackId + ':' + s.problemId));
    for (const track of ordered) {
      for (const p of track.problems) if (!tried.has(track.id + ':' + p.id)) return { kind: 'try', trackId: track.id, problemId: p.id };
    }
    const t = MT.data.tracks[0];
    return { kind: 'try', trackId: t.id, problemId: t.problems[0].id };
  }

  MT.flow = {
    MODES, getHint, startExplanation, currentExplainCheck, answerExplainCheck, submitReasoning,
    ORIGINAL_SEED, MAX_PROBES, MAX_RECOVERY_LOOPS, escalate, priorGapCounts, ctxParams, originalProblem, verificationProblem, presentMCQ, lockedBy, startSession, startRecoveryFor,
    submitAttempt, currentProbe, answerProbe, beginRecovery, completeLesson, currentPractice, answerPractice,
    startVerification, submitVerification, tryAgain, nextAction,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.flow;
})(typeof window !== 'undefined' ? window : globalThis);
