/* Session orchestration: attempt -> diagnosis -> probe -> recovery -> verification.
 * Every state change goes through MT.machine; every mastery change goes through the store. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});

  const ORIGINAL_SEED = 1;
  const MAX_PROBES = 3;

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
    const gs = store.graphState(trackId);
    const gr = MT.graph.build(track);
    return MT.graph.blockedBy(gr, def.target, (id) => gs[id].status === 'CONFIRMED_GAP');
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
    let res = MT.diagnose.diagnose(track, problem, answer, working, mastery);
    if (res.category === 'INVALID_INPUT') return { ok: false, error: res.reason };

    if (problem.answer.kind === 'open') {
      // No deterministic checker exists for open-ended answers: the judgement (AI or demo rubric) decides, and says so.
      const j = opts && opts.judgement;
      if (!j) return { ok: false, error: 'This answer needs a judgement before it can be diagnosed.' };
      if (j.isCorrect) res = { engine: j.engine, category: 'CORRECT', confidence: j.confidence, evidence: j.evidence, matchedBy: j.matchedBy || 'ai', hintConcept: null, candidates: [] };
      else res = applyOverride(track, res, j, mastery);
      res.judged = true;
    }

    const override = opts && opts.override;
    if (override && res.matchedBy === 'fallback' && res.category !== 'CORRECT') res = applyOverride(track, res, override, mastery);

    const now = store.now();
    MT.machine.transition(s, 'ATTEMPT_SUBMITTED', 'attempt ' + (s.attemptCount + 1), now);
    s.attemptCount += 1;
    s.attempt = { answer: String(answer), working: String(working || ''), at: now };

    if (res.category === 'CORRECT') {
      MT.machine.transition(s, 'ATTEMPT_CORRECT', 'verified correct', now);
      s.diagnosis = res;
      s.result = { ...(s.result || {}), solved: true };
      logEvent(store, s, 'ATTEMPT', { category: 'CORRECT', correct: true });
      const o = store.observe(s.trackId, track.target, true, { sessionId: s.id, problemId: s.problemId, source: 'attempt' });
      s.result.targetBefore = o.before;
      s.result.targetAfter = o.after;
      store.touch(s);
      return { ok: true, session: s, diagnosis: res };
    }

    MT.machine.transition(s, 'ERROR_CLASSIFIED', res.category, now);
    s.diagnosis = res;
    s.probeIndex = 0;
    logEvent(store, s, 'ATTEMPT', { category: res.category, correct: false, conceptId: res.hintConcept || null, matchedBy: res.matchedBy });

    let candidates = res.candidates || [];
    if (res.category === 'UNIT_ERROR' && res.hintConcept) {
      const priorUnit = store.events().filter((e) => e.type === 'ATTEMPT' && e.category === 'UNIT_ERROR' && e.trackId === s.trackId && e.sessionId !== s.id).length;
      const sameSession = store.events().filter((e) => e.type === 'ATTEMPT' && e.category === 'UNIT_ERROR' && e.sessionId === s.id).length;
      if (priorUnit + sameSession >= 2) {
        candidates = [{ id: res.hintConcept, score: 1, parts: {}, fromEvidence: true }];
        res.escalated = true;
      }
    }
    res.candidates = candidates;

    if (candidates.length) {
      MT.machine.transition(s, 'PROBE_REQUIRED', 'probe ' + candidates[0].id, now);
    } else {
      MT.machine.transition(s, 'RETRY_REQUIRED', res.category === 'CARELESS_SLIP' ? 'slip: no mastery change' : 'no probe needed', now);
    }
    store.touch(s);
    return { ok: true, session: s, diagnosis: res };
  }

  /* Optional AI classification (already schema-validated by ai.js) replaces only a fallback result. */
  function applyOverride(track, res, ov, mastery) {
    const gr = MT.graph.build(track);
    const out = Object.assign({}, res, {
      engine: ov.engine || 'gemini', category: ov.category, confidence: ov.confidence, evidence: ov.evidence, matchedBy: ov.matchedBy || 'ai',
      hintConcept: gr.byId.has(ov.hintConcept) ? ov.hintConcept : null,
    });
    if (out.category === 'PREREQUISITE_GAP' || out.category === 'CONCEPT_MISCONCEPTION') {
      const hints = out.hintConcept ? { [out.hintConcept]: 0.8 } : {};
      const ranked = MT.graph.rankSuspects(gr, track.target, mastery, { hints, includeTarget: true }).filter((r) => r.score > 0).slice(0, MAX_PROBES);
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
    const o = store.observe(s.trackId, probe.concept.id, correct, { sessionId: s.id, problemId: s.problemId, source: 'probe' });
    const entry = { conceptId: probe.concept.id, correct, before: o.before, after: o.after };
    s.probes.push(entry);
    const advance = (note) => {
      if (s.probeIndex + 1 < Math.min(MAX_PROBES, s.diagnosis.candidates.length)) {
        s.probeIndex += 1;
        MT.machine.transition(s, 'PROBE_REQUIRED', note, now);
        return 'NEXT_PROBE';
      }
      MT.machine.transition(s, 'RETRY_REQUIRED', 'probes found no confirmed gap', now);
      return 'NO_GAP';
    };
    let outcome;
    if (!correct && o.after < MT.bkt.DEFAULTS.gapBelow) {
      s.gap = { conceptId: probe.concept.id, p: o.after, evidence: s.diagnosis.evidence.slice(), misconception: probe.concept.lesson.misconception };
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
    const r = store.learn(s.trackId, s.recovery.conceptId, { sessionId: s.id, source: 'lesson' });
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
    const o = store.observe(s.trackId, pr.concept.id, correct, { sessionId: s.id, source: 'practice' });
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

    if (res.category === 'CORRECT') {
      const before = store.p(s.trackId, gapId);
      const o = store.observe(s.trackId, gapId, true, { sessionId: s.id, source: 'verification' });
      if (gapId !== track.target) store.observe(s.trackId, track.target, true, { sessionId: s.id, source: 'verification-transfer' });
      attempt.after = o.after;
      if (o.after >= MT.bkt.DEFAULTS.masteredAt) {
        MT.machine.transition(s, 'MASTERY_VERIFIED', 'verified', now);
        s.result = Object.assign(s.result || {}, { verified: true, conceptId: gapId, before: s.verification.pEntry, after: o.after });
        logEvent(store, s, 'MASTERY_VERIFIED', { conceptId: gapId, before, after: o.after });
        store.touch(s);
        return { ok: true, session: s, outcome: 'VERIFIED', diagnosis: res, before, after: o.after };
      }
      s.verification.issued += 1;
      const pick = pickVerification(store, s);
      s.verification.defId = pick.defId; s.verification.seed = pick.seed;
      store.touch(s);
      return { ok: true, session: s, outcome: 'NEEDS_MORE', diagnosis: res, before, after: o.after };
    }

    const implicated = res.hintConcept === gapId && (res.category === 'PREREQUISITE_GAP' || res.category === 'CONCEPT_MISCONCEPTION' || res.category === 'UNIT_ERROR');
    if (implicated) {
      const o = store.observe(s.trackId, gapId, false, { sessionId: s.id, source: 'verification' });
      attempt.after = o.after;
      MT.machine.transition(s, 'RECOVERY_REQUIRED', 'verification failed on the same concept', now);
      s.gap.p = o.after;
      s.recovery = null;
      s.verification.failedOnce = true;
      logEvent(store, s, 'VERIFICATION_FAILED', { conceptId: gapId, before: o.before, after: o.after });
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
    if (s.state === 'ATTEMPT_CORRECT' || s.state === 'RETRY_REQUIRED') MT.machine.transition(s, 'READY', 'new attempt', now);
    if (s.state === 'READY') {
      if (s.attempt) s.history.push({ attempt: s.attempt, category: s.diagnosis && s.diagnosis.category });
      s.attempt = null; s.diagnosis = null; s.probes = []; s.probeIndex = 0; s.gap = null; s.recovery = null; s.verification = null;
      s.result = Object.assign({}, s.result, { solved: false });
    }
    store.touch(s);
    return s;
  }

  /* What the student should do next, for the dashboard. */
  function nextAction(store) {
    const open = store.sessionList().find((s) => !s.closed && !['READY', 'ATTEMPT_CORRECT', 'MASTERY_VERIFIED'].includes(s.state));
    if (open) return { kind: 'continue', session: open };
    const focus = store.settings().examFocus;
    const ordered = MT.data.tracks.slice().sort((a, b) => (b.domainId === focus) - (a.domainId === focus));
    for (const track of ordered) {
      const gs = store.graphState(track.id);
      const gap = track.concepts.filter((c) => gs[c.id].status === 'CONFIRMED_GAP').sort((a, b) => gs[a.id].p - gs[b.id].p)[0];
      if (gap) return { kind: 'recover', trackId: track.id, conceptId: gap.id };
    }
    const tried = new Set(store.sessionList().map((s) => s.trackId + ':' + s.problemId));
    for (const track of ordered) {
      for (const p of track.problems) if (!tried.has(track.id + ':' + p.id)) return { kind: 'try', trackId: track.id, problemId: p.id };
    }
    const t = MT.data.tracks[0];
    return { kind: 'try', trackId: t.id, problemId: t.problems[0].id };
  }

  MT.flow = {
    ORIGINAL_SEED, MAX_PROBES, originalProblem, verificationProblem, presentMCQ, lockedBy, startSession, startRecoveryFor,
    submitAttempt, currentProbe, answerProbe, beginRecovery, completeLesson, currentPractice, answerPractice,
    startVerification, submitVerification, tryAgain, nextAction,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.flow;
})(typeof window !== 'undefined' ? window : globalThis);
