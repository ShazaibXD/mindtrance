/* Guided demo tour. A panel that follows the session state, says in plain words what the system just did and why,
 * highlights the one control to use next, and offers "do it for me" shortcuts for the tedious bits.
 * step() is pure (state in, description out) so it can be tested without a browser. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const ui = (MT.ui = MT.ui || {});

  const TOTAL = 9;
  const TRACK = 'eee-transformers';
  const PROBLEM = 'tx-secondary-current';

  ui.tourOff = false;
  ui.tourLast = null;
  ui.tourSel = null;

  const isTourProblem = (trackId, problemId) => trackId === TRACK && problemId === PROBLEM;
  const pct = (v) => Math.round(v * 100);
  const f2 = (v) => Number(v).toFixed(2);

  /* Describes the current step. ctx = { trackId, problemId, session, draftsFilled, conceptName(id) }. */
  function step(ctx) {
    const s = ctx.session;
    const st = s ? s.state : 'READY';
    const name = ctx.conceptName;
    const verified = !!(s && s.result && s.result.verified);
    const d = s && s.diagnosis;

    if (st === 'READY' && !verified) {
      if (!ctx.draftsFilled) {
        return {
          n: 1, title: 'Meet a student who got this wrong',
          body: 'A student answered this transformer problem with 200 A. The correct answer is hidden on purpose, because MINDTRACE is not here to hand out answers. Its job is to find out why an answer is wrong.',
          why: 'Most tools say "wrong, here is the answer". Knowing why is what lets you fix the cause instead of the symptom.',
          cta: [{ label: 'Fill in the demo wrong attempt', action: 'demo-fill', primary: true, note: 'final answer only, no working' }, { label: 'Fill in with working', action: 'demo-fill-working', note: 'also shows the steps, to compare how the evidence changes' }],
          focus: '#a-ans',
        };
      }
      return { n: 2, title: 'Now submit it', body: 'Press Submit attempt. The number is checked by plain code, not by an AI, so a right or wrong verdict on a number is always the same and can be trusted.', why: 'Using a model to mark arithmetic would add errors. Models are only used where code cannot judge.', cta: [], focus: '[data-fk="attempt-submit"]' };
    }
    if (st === 'READY' && verified) {
      if (!ctx.draftsFilled) return { n: 9, title: 'Back to the original problem', body: 'The original problem is unlocked again. This is the same problem that went wrong at the start. Can the student solve it now?', why: 'Fixing the foundation only counts if the original problem now works.', cta: [{ label: 'Fill in the correct answer', action: 'demo-fill-correct', primary: true }], focus: '#a-ans' };
      return { n: 9, title: 'Press submit to finish', body: 'Press Submit attempt to finish the loop.', cta: [], focus: '[data-fk="attempt-submit"]' };
    }
    if (st === 'PROBE_REQUIRED' && d) {
      const cand = d.candidates && d.candidates[s.probeIndex || 0];
      const c = cand ? name(cand.id) : 'one concept';
      const score = pct(d.evidenceScore != null ? d.evidenceScore : d.confidence);
      const later = s.probes && s.probes.length > 0;
      return {
        n: 3, title: later ? 'That one passed, so the next suspect is checked' : 'Why it asks a question first',
        body: later
          ? 'The student got that question right, which rules out the previous suspect. This is how MINDTRACE avoids blaming the wrong concept. It will ask at most two questions in total.'
          : 'The student gave only a final answer, which is thin evidence. MINDTRACE scores it ' + score + '%, below its 45% line, so it does not guess. It names its best hypothesis, ' + c + ', and asks one short question to test it. The "Evidence score" on the right shows how it got that number.',
        why: 'Teaching the wrong concept wastes the student\'s time. One question is cheaper.',
        cta: [{ label: 'Answer as the student would', action: 'demo-pick-wrong', primary: true, note: 'picks the answer a reversed turns ratio gives' }],
        focus: '#stage form[data-form="probe"]',
      };
    }
    if (st === 'GAP_CONFIRMED' && s.gap) {
      const c = name(s.gap.conceptId);
      const last = s.probes && s.probes[s.probes.length - 1];
      const fromWorking = s.gap.confirmedBy === 'evidence';
      return {
        n: 4, title: 'The cause is confirmed',
        body: fromWorking
          ? 'The student\'s own working showed the mistake (evidence score ' + pct(d.evidenceScore) + '%, above the 75% line), so no extra question was needed. The gap is in ' + c + ', and its mastery estimate is now ' + f2(s.gap.p) + '.'
          : 'The question was missed, so the gap is in ' + c + '. Its mastery estimate fell from ' + f2(last ? last.before : 0.55) + ' to ' + f2(s.gap.p) + ', below the 0.45 line, so it is now a confirmed gap, not a guess.',
        why: 'The original problem is now locked, and the map marks it as blocked. Retrying it before fixing the foundation would only repeat the error.',
        cta: [{ label: 'See what the map shows', href: ctx.mapHref }],
        focus: '[data-fk="start-recovery"]',
      };
    }
    if (st === 'RECOVERY_IN_PROGRESS' && s.recovery) {
      if (s.recovery.step === 'lesson') return { n: 5, title: 'A short lesson on exactly what went wrong', body: 'The lesson opens with what the student\'s answer showed, names the common trap they fell into, and shows one short example. It is short on purpose.', why: 'Learning is credited once, after the lesson, never for answering wrongly.', cta: [], focus: '[data-fk="lesson-done"]' };
      if (s.recovery.step === 'practice') return { n: 6, title: 'One practice question, instant feedback', body: 'A wrong answer here lowers the estimate again. That is an honest signal, not a penalty. The shortcut picks the right option for you.', why: 'Practice shows whether the lesson landed before the student is tested on something new.', cta: [{ label: 'Pick the right answer for me', action: 'demo-pick-practice', primary: true }], focus: '#stage form[data-form="practice"]' };
      return { n: 6, title: 'Practice passed', body: 'Next comes a fresh problem. It uses new numbers and a new setting so the student cannot copy the earlier steps.', cta: [], focus: '[data-fk="to-verify"]' };
    }
    if (st === 'VERIFICATION_REQUIRED') {
      const tries = s.verification && s.verification.attempts ? s.verification.attempts.length : 0;
      return {
        n: 7, title: tries ? 'Correct, but one success is not enough yet' : 'A fresh problem, to prove it transferred',
        body: tries ? 'The estimate is still below 0.80, so another fresh problem is issued. One lucky answer should not count as mastery.' : 'Same idea, different numbers and wording. The answer key is computed by code, not written by a model, so it cannot be wrong. The shortcut fills in the right answer.',
        why: 'A student who only memorised the last steps would fail here.',
        cta: [{ label: 'Fill in the answer for me', action: 'demo-fill-verify', primary: true }], focus: '#v-ans',
      };
    }
    if (st === 'MASTERY_VERIFIED' && s.result) {
      return {
        n: 8, title: 'Verified: the foundation is fixed',
        body: 'The estimate for ' + name(s.result.conceptId) + ' went from ' + f2(s.result.before) + ' to ' + f2(s.result.after) + '. On the map it turns green, the original problem unlocks, and a review is booked in about a week.',
        why: 'Estimates fade without practice, so verified concepts come back for a quick check later.',
        cta: [{ label: 'See the updated map', href: ctx.mapHref }], focus: '[data-fk="retry-original"]',
      };
    }
    if (st === 'ATTEMPT_CORRECT') {
      return {
        n: 9, title: 'That is the whole loop', done: true,
        body: 'The student wrong-answered, MINDTRACE asked instead of guessing, confirmed the cause, taught only that, proved it with a fresh problem, and the original problem now works.',
        list: ['A wrong answer was classified with a visible evidence score.', 'A short question replaced a guess.', 'Only the missing concept was taught.', 'A fresh problem checked the fix, with a code-computed key.', 'The map, estimates and review schedule all updated.'],
        cta: [{ label: 'Replay with the working shown', action: 'demo-replay-working', primary: true, note: 'strong evidence skips the question' }, { label: 'Ask your own question', href: ctx.askHref }],
        focus: null,
      };
    }
    return { n: null, title: 'You are off the main path, which is fine', body: 'This is a side route of the same engine. Explore it, or restart the guided demo from the beginning at any time.', cta: [{ label: 'Restart the demo', action: 'demo-reset' }], focus: null };
  }

  const LABELS = ['Meet', 'Submit', 'Question', 'Confirm', 'Lesson', 'Practice', 'Fresh problem', 'Verified', 'Retry'];

  function stepperHtml(info) {
    const { esc } = ui;
    return '<ol class="demo-steps" aria-label="Demo progress">' + LABELS.map((l, i) => {
      const n = i + 1;
      const cls = !info.n ? '' : n < info.n ? 'done' : n === info.n ? 'now' : '';
      return '<li class="' + cls + '"' + (cls === 'now' ? ' aria-current="step"' : '') + '><span class="dot">' + (cls === 'done' ? '&#10003;' : n) + '</span><span class="lab">' + esc(l) + '</span></li>';
    }).join('') + '</ol>';
  }

  /* What MINDTRACE currently believes: only concepts with evidence, with where each started. */
  function beliefsHtml(store, track) {
    const { esc } = ui;
    const gs = store.graphState(track.id);
    const rows = track.concepts.filter((c) => store.record(track.id, c.id).obs > 0 || c.id === track.target);
    const quiet = track.concepts.length - rows.length;
    return '<section class="card beliefs" aria-labelledby="bl-h"><div class="card-head"><h3 id="bl-h" class="h3">What it believes about each concept</h3></div>'
      + (rows.length ? '<ul class="list-reset belief-list">' + rows.map((c) => {
        const st = gs[c.id];
        const rec = store.record(track.id, c.id);
        const moved = rec.obs > 0 && Math.abs(st.p - c.prior) > 0.02;
        return '<li class="' + (moved ? 'moved' : '') + '"><div class="row between"><span>' + esc(c.name) + '</span>' + ui.badge(ui.STATUS[st.status].cls, ui.STATUS[st.status].short) + '</div>' + ui.meter(st.p, ui.STATUS[st.status].cls)
          + '<div class="faint small">' + (rec.obs > 0 ? 'started at ' + f2(c.prior) + ', now <strong>' + f2(st.p) + '</strong>' : 'no answers yet, ' + f2(st.p) + ' is only a starting assumption') + '</div></li>';
      }).join('') + '</ul>' : '<p class="muted">Nothing yet.</p>')
      + (quiet > 0 ? '<p class="faint small">' + quiet + ' other concept' + (quiet > 1 ? 's' : '') + ' not assessed yet.</p>' : '') + '</section>';
  }

  /* A plain-words log of what has happened in this session, newest first. */
  function logHtml(store, session) {
    const { esc } = ui;
    const evs = session ? store.events().filter((e) => e.sessionId === session.id).slice(-6).reverse() : [];
    return '<section class="card" aria-labelledby="lg-h"><div class="card-head"><h3 id="lg-h" class="h3">What just happened</h3></div>'
      + (evs.length ? '<ul class="list small">' + evs.map((e) => '<li><span>' + esc(ui.describeEvent(e).text) + '</span><span class="faint">' + ui.ago(e.at) + '</span></li>').join('') + '</ul>' : '<p class="muted">Nothing yet. This fills in as the student acts.</p>') + '</section>';
  }

  function panelHtml(info, variant) {
    const { esc } = ui;
    const dots = info.n && variant !== 'narration' ? '<div class="tour-dots" aria-hidden="true">' + Array.from({ length: TOTAL }, (_, i) => '<span class="' + (i + 1 < info.n ? 'done' : i + 1 === info.n ? 'now' : '') + '"></span>').join('') + '</div>' : '';
    const cta = (info.cta || []).map((c) => c.href
      ? '<a class="btn" href="' + esc(c.href) + '">' + esc(c.label) + '</a>'
      : '<span class="tour-act"><button class="btn ' + (c.primary ? 'primary' : '') + '" type="button" data-action="' + esc(c.action) + '" data-fk="tour-' + esc(c.action) + '">' + esc(c.label) + '</button>' + (c.note ? '<span class="faint small">' + esc(c.note) + '</span>' : '') + '</span>').join('');
    const head = '<div class="tour-top"><span class="badge gold">Guided demo</span>' + (info.n ? '<span class="tour-count">Step ' + info.n + ' of ' + TOTAL + '</span>' : '') + '<button class="linkbtn small tour-hide" type="button" data-action="tour-off">Hide tour</button></div>';
    const main = '<h2 class="tour-title">' + esc(info.title) + '</h2><p class="tour-body">' + esc(info.body) + '</p>'
      + (info.list ? '<ul class="tour-list">' + info.list.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '');
    const side = (info.why ? '<p class="tour-why"><strong>Why it matters.</strong> ' + esc(info.why) + '</p>' : '')
      + (cta ? '<div class="tour-cta">' + cta + '</div>' : '') + '<p class="tour-hint small" role="status"></p>';
    if (variant === 'narration') return '<aside class="tour card demo-narration" aria-label="Guided demo">' + head + '<div class="narr-grid"><div class="narr-main">' + main + '</div><div class="narr-side">' + side + '</div></div></aside>';
    return '<aside class="tour card" aria-label="Guided demo">' + head + dots + main + side + '</aside>';
  }

  MT.tour = { TOTAL, TRACK, PROBLEM, LABELS, isTourProblem, step, panelHtml, stepperHtml, beliefsHtml, logHtml };
  ui.tour = MT.tour;
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.tour;
})(typeof window !== 'undefined' ? window : globalThis);
