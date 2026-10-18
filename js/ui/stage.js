/* Workspace stage panel: renders the right-hand side for each diagnostic state. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const ui = MT.ui;
  const { esc, fmt } = ui;

  const ENGINE = {
    'rule-based': 'Rule-based engine (deterministic, no AI)',
    gemini: 'Gemini reading, schema-validated. For open-ended answers this is an AI judgement, not a verified result.',
    'demo-rubric': 'Demo rubric: scripted keyword rules, not AI. Used only for the demo question.',
  };

  const noteHtml = (n) => (n ? '<div class="notice ' + n.kind + '" role="status">' + ui.icon(n.kind === 'good' ? 'check' : n.kind === 'bad' ? 'alert' : 'info') + '<div>' + n.html + '</div></div>' : '');

  function mcq(name, m) {
    return '<fieldset class="options" style="border:0;padding:0;margin:0"><legend class="sr-only">Answer options</legend>'
      + m.options.map((o, i) => '<label class="option"><input type="radio" name="' + name + '" value="' + o.index + '"' + (i === 0 ? ' required' : '') + '><span class="math">' + fmt(o.text) + '</span></label>').join('') + '</fieldset>';
  }

  function conceptOf(session, id) {
    return MT.data.track(session.trackId).concepts.find((c) => c.id === id);
  }

  const TIER_TEXT = {
    INSUFFICIENT: 'Below 45%: not enough to name a cause, so one short question comes first.',
    SUSPECTED: '45% to 75%: a working hypothesis that is checked before anything is taught.',
    CONFIRMED: '75% or more: your own working shows the cause.',
  };

  function evidenceBlock(d, session) {
    const items = d.evidenceItems || [];
    return '<div><div class="row between small"><span class="label">Evidence score</span><span class="mono">' + ui.pct(d.evidenceScore != null ? d.evidenceScore : d.confidence) + '%</span></div>' + ui.meter(d.evidenceScore != null ? d.evidenceScore : d.confidence)
      + '<p class="hint">' + esc(TIER_TEXT[d.tier] || 'A heuristic measure of how well the evidence fits, not a calibrated probability.') + (session && session.gap && session.gap.confirmedBy === 'probe' ? ' The follow-up question then confirmed it.' : '') + '</p>'
      + (items.length ? '<details><summary class="small muted">How this score is built</summary><table class="tbl small"><thead><tr><th>Evidence</th><th>Reliability</th><th>Fit</th></tr></thead><tbody>' + items.map((i) => '<tr><td>' + esc(MT.diagnose.SOURCE_LABEL[i.source] || i.source) + '<br><span class="faint">' + esc(i.note) + '</span></td><td class="mono">' + ui.f2(i.w) + '</td><td class="mono">' + ui.f2(i.r) + '</td></tr>').join('') + '</tbody></table><p class="hint">Score = 1 - product of (1 - reliability x fit). A heuristic, not a calibrated probability.</p></details>' : '') + '</div>';
  }

  /* One sentence a newcomer can read without knowing any of the terms. */
  function plainWords(d, eff, concept, session) {
    const kind = MT.diagnose.kindOf(eff);
    const name = concept ? concept.name : 'one concept';
    if (kind === 'slip') return 'Your approach looks fine. A small slip changed the answer, so nothing needs to be taught.';
    if (eff === 'AMBIGUOUS_OR_INSUFFICIENT_EVIDENCE') return 'There is not enough to be sure why this went wrong. My best guess is ' + name + ', and one short question will tell.';
    if (session.state === 'GAP_CONFIRMED') return 'The cause is now clear: ' + name + ' is the missing piece, and that is what gets fixed first.';
    if (kind === 'gap' || kind === 'partial') return 'This looks like a problem with ' + name + ', not with the whole topic. Checking that before anything is taught.';
    return '';
  }

  function diagnosisCard(session) {
    const d = session.diagnosis;
    // once a question or the working has confirmed the gap, the label is the confirmed outcome, not "not enough evidence"
    const eff = session.gap ? d.category : MT.diagnose.effectiveOutcome(d);
    const cat = MT.diagnose.outcomeMeta(eff);
    const cls = ui.outcomeCls(eff);
    const top = d.candidates && d.candidates[session.probeIndex || 0];
    const concept = top ? conceptOf(session, top.id) : null;
    const hasCands = d.candidates && d.candidates.length > 0;
    const working = session.attempt && session.attempt.working.trim();
    const plain = plainWords(d, eff, concept, session);
    return '<div class="card stack" style="--gap-y:12px"><div class="row between"><h3 id="stage-title" tabindex="-1">Diagnosis</h3><span class="badge ' + cls + '"><span class="dot"></span>' + esc(cat.label) + '</span></div>'
      + '<p class="muted">' + esc(cat.blurb) + '</p>'
      + (eff !== d.category ? '<p class="small">Leading hypothesis so far: <strong>' + esc(MT.diagnose.outcomeMeta(d.category).label) + '</strong>.</p>' : '')
      + (plain ? '<p class="plain"><strong>In plain words:</strong> ' + esc(plain) + '</p>' : '')
      + evidenceBlock(d, session)
      + '<div><p class="label">Evidence from your work</p><ul class="steps">' + d.evidence.map((e) => '<li>' + fmt(e) + '</li>').join('') + '</ul>'
      + (working ? '<details><summary class="small muted">Your working as submitted</summary><pre class="quote">' + esc(session.attempt.working) + '</pre></details>' : '<p class="hint">No working was submitted. Showing your steps gives the diagnosis much stronger evidence.</p>') + '</div>'
      + (concept && ['PROBE_REQUIRED', 'ERROR_CLASSIFIED'].includes(session.state)
        ? '<div class="notice info">' + ui.icon('info') + '<div><strong>Hypothesis: ' + esc(concept.name) + '</strong> <span class="badge suspect">suspected, not confirmed</span><p class="muted small">Why it matters here: ' + fmt(concept.lesson.why) + '</p></div></div>' : '')
      + (hasCands && d.candidates.length > 1 ? '<details><summary class="small muted">All hypotheses, ranked from the graph</summary><table class="tbl small"><thead><tr><th>Concept</th><th>Dependency</th><th>Mastery</th><th>Evidence</th></tr></thead><tbody>'
        + d.candidates.map((c) => '<tr><td>' + esc(conceptOf(session, c.id).name) + '</td><td class="mono">' + (c.parts.pathWeight != null ? ui.f2(c.parts.pathWeight) : '-') + '</td><td class="mono">' + (c.parts.mastery != null ? ui.f2(c.parts.mastery) : '-') + '</td><td>' + (c.fromEvidence ? 'from your answer' : 'graph only') + '</td></tr>').join('') + '</tbody></table></details>' : '')
      + '<p class="hint">' + esc(ENGINE[d.engine] || d.engine) + '</p></div>';
  }

  function probeCard(session) {
    const pr = MT.flow.currentProbe(session);
    if (!pr) return '';
    const tier = session.diagnosis && session.diagnosis.tier;
    const weak = tier === 'INSUFFICIENT';
    const pct = session.diagnosis ? ui.pct(session.diagnosis.evidenceScore != null ? session.diagnosis.evidenceScore : session.diagnosis.confidence) : 0;
    return '<form class="card stack" data-form="probe" style="--gap-y:12px"><div class="row between"><h3>' + (weak ? 'Follow-up question' : 'Diagnostic check') + ' ' + pr.number + ' of up to ' + pr.total + '</h3><span class="badge">' + esc(pr.concept.name) + '</span></div>'
      + (weak ? '<div class="notice warn">' + ui.icon('info') + '<p class="small"><strong>Not sure yet.</strong> The evidence so far is too thin (' + pct + '%) to say what is missing. This question checks the most likely concept before anything is taught.</p></div>'
        : tier === 'SUSPECTED' ? '<div class="notice info">' + ui.icon('info') + '<p class="small"><strong>Working hypothesis (' + pct + '%).</strong> It looks like this concept is the sticking point. A quick check will confirm or rule it out.</p></div>'
          : '<p class="muted small">A one-step question on the suspected concept only. It does not reveal the answer to your problem.</p>')
      + '<p class="math problem-text">' + fmt(pr.mcq.q) + '</p>' + mcq('opt', pr.mcq)
      + '<div><button class="btn primary" type="submit" data-fk="probe-submit">Submit probe answer</button></div></form>';
  }

  const LEVEL_LABEL = ['', 'Foundation', 'Link', 'Target idea'];

  function explanationCard(session, store) {
    const track = MT.data.track(session.trackId);
    const ex = session.explain;
    const blocks = ex.concepts.map((id, i) => {
      const c = conceptOf(session, id);
      const L = c.lesson;
      return '<div class="card elev stack" style="--gap-y:8px"><div class="row between"><h4>' + (ex.concepts.length > 1 ? (i + 1) + '. ' : '') + esc(c.name) + '</h4><span class="badge">' + LEVEL_LABEL[c.level] + '</span></div>'
        + '<p class="math">' + fmt(L.explain) + '</p><p class="small muted">Why it matters here: ' + fmt(L.why) + '</p>'
        + '<p class="small"><strong>Common trap:</strong> ' + fmt(L.misconception) + '</p><p class="small math"><strong>Example.</strong> ' + fmt(L.example.q) + ' ' + fmt(L.example.a) + '</p></div>';
    }).join('');
    const chk = MT.flow.currentExplainCheck(session);
    return '<div class="card stack" style="--gap-y:12px"><div class="row between"><h3 id="stage-title" tabindex="-1">' + (ex.mode === 'TEACH_FROM_BASICS' ? 'From the basics up' : 'The concept') + '</h3><span class="badge sage">direct explanation</span></div>'
      + '<p class="muted small">You asked for an explanation, so there are no questions first. Nothing here changes your mastery estimates unless you take the optional check.</p>' + blocks
      + (ex.checkDone ? '<div class="notice good">' + ui.icon('check') + '<p class="small">Quick check passed.</p></div>'
        : '<form class="stack" data-form="explainCheck" style="--gap-y:10px"><p class="label">Optional quick check: ' + esc(chk.concept.name) + '</p><p class="math problem-text">' + fmt(chk.mcq.q) + '</p>' + mcq('opt', chk.mcq) + '<div><button class="btn" type="submit" data-fk="explain-check">Check my understanding</button></div></form>')
      + '<div class="row"><button class="btn primary" type="button" data-action="try-again" data-fk="back-to-problem">Back to the problem</button><a class="btn" href="' + ui.link('map', { track: session.trackId }) + '">Open the map</a></div></div>';
  }

  function reasoningCard(session) {
    return '<form class="card stack" data-form="reasoning" style="--gap-y:12px"><h3 id="stage-title" tabindex="-1">Right answer. One quick check</h3>'
      + '<div class="notice good">' + ui.icon('check') + '<p class="small">The answer looks right. A right answer alone does not show the idea behind it, so nothing is credited yet.</p></div>'
      + '<div class="field"><label for="r-ans">How did you get there?</label><textarea class="textarea prose" id="r-ans" name="reasoning" maxlength="1500" placeholder="A sentence or two is enough" required></textarea><div class="error-text" role="alert">' + esc(ui.reasonError || '') + '</div></div>'
      + '<div><button class="btn primary" type="submit" data-fk="reasoning-submit"' + (ui.busy ? ' disabled' : '') + '>' + (ui.busy ? '<span class="spin" aria-hidden="true"></span>Reading your reasoning' : 'Submit my reasoning') + '</button></div></form>';
  }

  function slipCard(session) {
    const d = session.diagnosis;
    const msg = {
      POSSIBLE_CARELESS_SLIP: 'This does not look like you. Want to double-check one line of your working? Your mastery estimates were not changed.',
      CALCULATION_OR_UNIT_ERROR: 'Your approach looks sound. Re-check the arithmetic and the units in the last steps. Your mastery estimates were not changed. A repeated unit slip will trigger a quick check on unit conversion.',
      READING_OR_INTERPRETATION_ERROR: 'The work answers a slightly different question than the one asked. Re-read the wording of the problem and try again. Your mastery estimates were not changed.',
      LANGUAGE_COMPREHENSION_DIFFICULTY: 'The wording of the question may be getting in the way. Re-read it slowly, in your own words, then try again. Your mastery estimates were not changed.',
    }[d.category] || 'No cause could be confirmed, so no mastery was lowered. Re-read the problem and try again.';
    return '<div class="card stack" style="--gap-y:12px"><p class="eyebrow">Next step</p><p>' + esc(msg) + '</p><div><button class="btn primary" type="button" data-action="try-again" data-fk="retry">Try again</button></div></div>';
  }

  function escalationCard(session) {
    const e = session.escalation || { concepts: [], solution: [] };
    const names = e.concepts.map((id) => conceptOf(session, id).name);
    return '<div class="card stack" style="--gap-y:12px"><h3 id="stage-title" tabindex="-1">Let\'s step back and look at it together</h3>'
      + '<p>' + (e.reason === 'recovery' ? 'You have worked through two rounds on this idea, and it is still not clicking. That happens, and it says something about the explanation as much as about you.' : 'Two short questions did not pinpoint what is missing, so instead of asking more, here is the full solution.') + '</p>'
      + (e.solution.length ? '<div><p class="label">Worked solution</p><ol class="steps math">' + e.solution.map((x) => '<li>' + fmt(x) + '</li>').join('') + '</ol></div>' : '<p class="muted">There is no stored worked solution for an open-ended question. Review the lessons on the map, then try again.</p>')
      + (names.length ? '<p class="small">Marked for review in two days: <strong>' + names.map(esc).join(', ') + '</strong>.</p>' : '')
      + '<div class="notice info">' + ui.icon('info') + '<p class="small">A teacher, tutor or classmate can often unstick this faster than another round of questions. Take the worked steps with you.</p></div>'
      + '<div class="row"><button class="btn primary" type="button" data-action="try-again" data-fk="retry">Try the problem again</button><a class="btn" href="' + ui.link('map', { track: session.trackId }) + '">Open the map</a></div></div>';
  }

  function gapCard(session) {
    const c = conceptOf(session, session.gap.conceptId);
    return '<div class="card stack" style="--gap-y:12px"><div class="row between"><h3 id="stage-title" tabindex="-1">Gap confirmed</h3><span class="badge gap"><span class="dot"></span>Confirmed gap</span></div>'
      + '<p><strong>' + esc(c.name) + '</strong>: ' + (session.gap.confirmedBy === 'evidence' ? 'your own working shows the cause (evidence ' + ui.pct(session.diagnosis.evidenceScore) + '%), so no extra question was needed.' : 'the probe was missed.') + ' The mastery estimate is now <span class="mono">' + ui.f2(session.gap.p) + '</span>, below the 0.45 threshold.</p>'
      + (session.gap.outcome === 'PROCEDURAL_ERROR' ? '<p class="muted">The idea and rule were right; a step went wrong. The recovery focuses on that step rather than re-teaching the basics.</p>' : '')
      + '<p class="muted">The original problem stays locked until this concept is recovered and re-verified on a fresh problem.</p>'
      + '<div><button class="btn primary" type="button" data-action="start-recovery" data-fk="start-recovery">Start recovery</button></div></div>';
  }

  function stepper(step) {
    const steps = [['lesson', 'Lesson'], ['practice', 'Practice'], ['verify', 'Verify']];
    const idx = { lesson: 0, practice: 1, done: 1, verify: 2 }[step];
    return '<ol class="stepper" aria-label="Recovery progress">' + steps.map((s, i) => '<li class="' + (i < idx ? 'done' : i === idx ? 'now' : '') + '"' + (i === idx ? ' aria-current="step"' : '') + '>' + s[1] + '</li>').join('') + '</ol>';
  }

  function recoveryCard(session, store) {
    const c = conceptOf(session, session.recovery.conceptId);
    const L = c.lesson;
    const st = store.conceptState(session.trackId, c.id);
    const personal = session.gap && session.gap.evidence && session.gap.evidence.length ? '<div class="notice gold">' + ui.icon('info') + '<div><strong>What your answer showed</strong><p class="small">' + fmt(session.gap.evidence[0]) + '</p></div></div>' : '';
    const head = '<div class="row between"><h3 id="stage-title" tabindex="-1">Recover: ' + esc(c.name) + '</h3><span class="badge ' + ui.STATUS[st.status].cls + '">' + ui.f2(st.p) + '</span></div>' + stepper(session.recovery.step);
    if (session.recovery.step === 'lesson') {
      const procedural = session.gap && session.gap.outcome === 'PROCEDURAL_ERROR';
      return '<div class="card stack" style="--gap-y:14px">' + head + personal
        + (procedural ? '<div class="notice info">' + ui.icon('info') + '<p class="small"><strong>You chose the right idea.</strong> This is about one step, so the definition is not repeated. Compare the correct step with yours below, then try the practice question.</p></div>' : '<div><p class="label">The idea</p><p class="math">' + fmt(L.explain) + '</p></div>')
        + '<div><p class="label">Why it matters here</p><p>' + fmt(L.why) + '</p></div>'
        + '<div class="notice warn">' + ui.icon('alert') + '<div><strong>Common misconception</strong><p class="small">' + fmt(L.misconception) + '</p></div></div>'
        + '<div class="card elev"><p class="label">Worked example</p><p class="math">' + fmt(L.example.q) + '</p><p class="math" style="margin-top:6px"><strong>' + fmt(L.example.a) + '</strong></p></div>'
        + '<div><button class="btn primary" type="button" data-action="lesson-done" data-fk="lesson-done">I have read this, continue to practice</button></div></div>';
    }
    const pr = MT.flow.currentPractice(session);
    if (session.recovery.practiceDone) {
      return '<div class="card stack" style="--gap-y:14px">' + head + '<div class="notice good">' + ui.icon('check') + '<p>Practice passed. Next is a fresh problem with new numbers to check the idea transfers.</p></div><div><button class="btn primary" type="button" data-action="to-verification" data-fk="to-verify">Go to verification</button></div></div>';
    }
    return '<form class="card stack" data-form="practice" style="--gap-y:14px">' + head + '<p class="label">Practice question</p><p class="math problem-text">' + fmt(pr.mcq.q) + '</p>' + mcq('opt', pr.mcq)
      + '<div><button class="btn primary" type="submit" data-fk="practice-submit">Check answer</button></div></form>';
  }

  function answerBox(idPrefix, problem, draftKey, extra) {
    const a = problem.answer;
    if (a.kind === 'open') {
      return '<div class="field"><label for="' + idPrefix + '-ans">Your answer</label><textarea class="textarea prose" id="' + idPrefix + '-ans" name="answer" maxlength="1500" placeholder="Write your answer in your own words" data-draft="ans:' + esc(draftKey) + '" aria-describedby="' + idPrefix + '-hint ' + idPrefix + '-err" required></textarea><div class="hint" id="' + idPrefix + '-hint">Open-ended answers are judged by Gemini (or the demo rubric). That is an AI judgement, not a verified result.</div><div class="error-text" id="' + idPrefix + '-err" role="alert">' + esc(extra || '') + '</div></div>'
        + '<div class="field"><label for="' + idPrefix + '-wrk">Your reasoning <span class="faint">(optional but it sharpens the diagnosis)</span></label><textarea class="textarea prose" id="' + idPrefix + '-wrk" name="working" maxlength="1500" placeholder="How did you get there?" data-draft="wrk:' + esc(draftKey) + '"></textarea></div>';
    }
    const hint = a.kind === 'expr' ? 'An expression in x. Use ^ for powers and brackets for functions, for example 2x cos(x^2).' : (a.unit ? 'A number with its unit, for example 2.5 ' + a.unit + '.' : 'A number' + (a.percentOk ? ' or a percentage.' : '.'));
    return '<div class="field"><label for="' + idPrefix + '-ans">Final answer</label><input class="input mono" id="' + idPrefix + '-ans" name="answer" autocomplete="off" spellcheck="false" maxlength="120" data-draft="ans:' + esc(draftKey) + '" aria-describedby="' + idPrefix + '-hint ' + idPrefix + '-err" required><div class="hint" id="' + idPrefix + '-hint">' + esc(hint) + '</div><div class="error-text" id="' + idPrefix + '-err" role="alert">' + esc(extra || '') + '</div></div>'
      + '<div class="field"><label for="' + idPrefix + '-wrk">Working steps <span class="faint">(optional but it helps the diagnosis)</span></label><textarea class="textarea" id="' + idPrefix + '-wrk" name="working" maxlength="1500" spellcheck="false" placeholder="Write your steps, one per line" data-draft="wrk:' + esc(draftKey) + '"></textarea></div>';
  }

  function verificationCard(session) {
    const vp = MT.flow.verificationProblem(session);
    const n = session.verification.attempts.length;
    return '<form class="card stack" data-form="verify" style="--gap-y:14px"><div class="row between"><h3 id="stage-title" tabindex="-1">Fresh verification problem</h3><span class="badge sage">new numbers</span></div>' + stepper('verify')
      + '<p class="muted small">This tests the same concept in a new setting. ' + (n ? 'Attempts so far: ' + n + '.' : '') + '</p>'
      + '<p class="problem-text math">' + fmt(vp.statement) + '</p>'
      + (vp.answer.kind === 'choice'
        ? mcq('opt', MT.flow.presentMCQ({ q: '', options: vp.answer.options }, session.id + ':v:' + session.verification.seed)) + '<div class="error-text" role="alert">' + esc(ui.vError || '') + '</div>'
        : answerBox('v', vp, 'v:' + session.id + ':' + session.verification.seed, ui.vError))
      + '<div><button class="btn primary" type="submit" data-fk="verify-submit">Submit for verification</button></div></form>';
  }

  function verifiedCard(session, store) {
    const r = session.result || {};
    const c = conceptOf(session, r.conceptId);
    const track = MT.data.track(session.trackId);
    const gs = store.graphState(session.trackId);
    const unlocked = MT.flow.lockedBy(store, session.trackId, session.problemId).length === 0;
    return '<div class="card stack" style="--gap-y:12px"><div class="row between"><h3 id="stage-title" tabindex="-1">Mastery verified</h3><span class="badge mastered"><span class="dot"></span>Mastered</span></div>'
      + '<p><strong>' + esc(c.name) + '</strong> went from <span class="mono">' + ui.f2(r.before) + '</span> to <span class="mono">' + ui.f2(r.after) + '</span> after recovery and a fresh verification problem.</p>'
      + '<ul class="steps small muted"><li>Learning transition applied once, after the lesson.</li><li>Practice and verification answers were recorded as observations.</li><li>' + esc(track.concepts.find((x) => x.id === track.target).name) + ' is now ' + esc(ui.STATUS[gs[track.target].status].label.toLowerCase()) + (unlocked ? ', so the original problem is unlocked.' : '.') + '</li></ul>'
      + '<div><button class="btn primary" type="button" data-action="try-again" data-fk="retry-original">Retry the original problem</button></div></div>';
  }

  function solvedCard(session) {
    const problem = MT.flow.originalProblem(session);
    const r = session.result || {};
    if (problem.answer.kind === 'open') {
      const d = session.diagnosis;
      return '<div class="card stack" style="--gap-y:12px"><div class="row between"><h3 id="stage-title" tabindex="-1">Correct</h3><span class="badge verify"><span class="dot"></span>AI-judged</span></div>'
        + '<p>' + (d.engine === 'demo-rubric' ? 'The demo rubric accepted this answer.' : 'Gemini judged this answer correct.') + ' <strong>This is a judgement, not a deterministically verified result.</strong></p>'
        + '<ul class="steps">' + d.evidence.map((e) => '<li>' + fmt(e) + '</li>').join('') + '</ul>'
        + (r.targetAfter != null ? '<p class="muted small">Target concept estimate: <span class="mono">' + ui.f2(r.targetBefore) + ' to ' + ui.f2(r.targetAfter) + '</span>.</p>' : '')
        + '<div class="row"><a class="btn primary" href="' + ui.link('map', { track: session.trackId }) + '">See the knowledge map</a><a class="btn" href="' + ui.link('ask') + '">Ask another question</a></div></div>';
    }
    return '<div class="card stack" style="--gap-y:12px"><div class="row between"><h3 id="stage-title" tabindex="-1">Correct</h3><span class="badge mastered"><span class="dot"></span>Verified correct</span></div>'
      + '<p>The answer was checked by deterministic comparison against the verified result' + (r.targetAfter != null ? '. Target concept estimate: <span class="mono">' + ui.f2(r.targetBefore) + ' to ' + ui.f2(r.targetAfter) + '</span>.' : '.') + '</p>'
      + (ui.store.settings().showSolution ? '<div><p class="label">Worked solution</p><ol class="steps math">' + problem.solution.map((s) => '<li>' + fmt(s) + '</li>').join('') + '</ol></div>' : '<p class="muted small">Worked solution hidden in your learning preferences.</p>')
      + '<div class="row"><a class="btn primary" href="' + ui.link('map', { track: session.trackId }) + '">See the knowledge map</a><a class="btn" href="' + ui.link('explore') + '">Pick another problem</a></div></div>';
  }

  ui.stage = function (session, store, note, opts) {
    const profile = store.profile();
    let body;
    if (!session || session.state === 'READY') {
      body = opts && opts.tour ? '' : '<div class="card stack" style="--gap-y:10px"><h3 id="stage-title" tabindex="-1">What happens after you submit</h3><ol class="steps muted"><li>Your answer is checked deterministically.</li><li>If it is wrong, the error is classified: slip, unit error, or a suspected gap, with evidence.</li><li>A suspected gap is tested with a short probe before anything is taught.</li><li>Confirmed gaps get a short lesson, practice, and a fresh verification problem.</li></ol></div>';
    } else if (session.state === 'ATTEMPT_CORRECT') body = solvedCard(session);
    else if (session.state === 'PROBE_REQUIRED') body = diagnosisCard(session) + probeCard(session);
    else if (session.state === 'RETRY_REQUIRED') body = (session.diagnosis ? diagnosisCard(session) : '') + slipCard(session);
    else if (session.state === 'GAP_CONFIRMED') body = (session.diagnosis ? diagnosisCard(session) : '') + gapCard(session);
    else if (session.state === 'ESCALATED_TO_SOLUTION') body = escalationCard(session);
    else if (session.state === 'DIRECT_EXPLANATION') body = explanationCard(session, store);
    else if (session.state === 'REASONING_CHECK') body = reasoningCard(session);
    else if (session.state === 'RECOVERY_REQUIRED') body = '<div class="card stack" style="--gap-y:12px"><h3 id="stage-title" tabindex="-1">The gap is still open</h3><p class="muted">Review the lesson again, then try another fresh problem.</p><div><button class="btn primary" type="button" data-action="start-recovery" data-fk="start-recovery">Return to the lesson</button></div></div>';
    else if (session.state === 'RECOVERY_IN_PROGRESS') body = recoveryCard(session, store);
    else if (session.state === 'VERIFICATION_REQUIRED') body = verificationCard(session);
    else if (session.state === 'MASTERY_VERIFIED') body = verifiedCard(session, store);
    else body = '<div class="card"><p>Working on it.</p></div>';
    return '<div class="stack" style="--gap-y:14px" aria-live="polite">' + noteHtml(note) + body + '</div>';
  };

  ui.noteHtml = noteHtml;
  ui.answerBox = answerBox;
  if (typeof module !== 'undefined' && module.exports) module.exports = ui.stage;
})(typeof window !== 'undefined' ? window : globalThis);
