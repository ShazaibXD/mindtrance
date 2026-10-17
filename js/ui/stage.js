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

  function diagnosisCard(session) {
    const d = session.diagnosis;
    const cat = MT.diagnose.CATEGORIES[d.category];
    const track = MT.data.track(session.trackId);
    const cls = ui.CATEGORY_CLS[d.category] || '';
    const top = d.candidates && d.candidates[session.probeIndex || 0];
    const concept = top ? conceptOf(session, top.id) : null;
    const hasCands = d.candidates && d.candidates.length > 0;
    const working = session.attempt && session.attempt.working.trim();
    return '<div class="card stack" style="--gap-y:12px"><div class="row between"><h3 id="stage-title" tabindex="-1">Diagnosis</h3><span class="badge ' + cls + '"><span class="dot"></span>' + esc(cat.label) + '</span></div>'
      + '<p class="muted">' + esc(cat.blurb) + '</p>'
      + '<div><div class="row between small"><span class="label">Evidence strength</span><span class="mono">' + ui.pct(d.confidence) + '%</span></div>' + ui.meter(d.confidence)
      + '<p class="hint">A heuristic measure of how well the evidence fits, not a calibrated probability.</p></div>'
      + '<div><p class="label">Evidence from your work</p><ul class="steps">' + d.evidence.map((e) => '<li>' + fmt(e) + '</li>').join('') + '</ul>'
      + (working ? '<details><summary class="small muted">Your working as submitted</summary><pre class="quote">' + esc(session.attempt.working) + '</pre></details>' : '') + '</div>'
      + (concept && ['PROBE_REQUIRED', 'ERROR_CLASSIFIED'].includes(session.state)
        ? '<div class="notice info">' + ui.icon('info') + '<div><strong>Hypothesis: ' + esc(concept.name) + '</strong> <span class="badge suspect">suspected, not confirmed</span><p class="muted small">Why it matters here: ' + fmt(concept.lesson.why) + '</p></div></div>' : '')
      + (hasCands && d.candidates.length > 1 ? '<details><summary class="small muted">All hypotheses, ranked from the graph</summary><table class="tbl small"><thead><tr><th>Concept</th><th>Dependency</th><th>Mastery</th><th>Evidence</th></tr></thead><tbody>'
        + d.candidates.map((c) => '<tr><td>' + esc(conceptOf(session, c.id).name) + '</td><td class="mono">' + (c.parts.pathWeight != null ? ui.f2(c.parts.pathWeight) : '-') + '</td><td class="mono">' + (c.parts.mastery != null ? ui.f2(c.parts.mastery) : '-') + '</td><td>' + (c.fromEvidence ? 'from your answer' : 'graph only') + '</td></tr>').join('') + '</tbody></table></details>' : '')
      + '<p class="hint">' + esc(ENGINE[d.engine] || d.engine) + (track ? '' : '') + '</p></div>';
  }

  function probeCard(session) {
    const pr = MT.flow.currentProbe(session);
    if (!pr) return '';
    const weak = session.diagnosis && session.diagnosis.confidence < 0.6;
    return '<form class="card stack" data-form="probe" style="--gap-y:12px"><div class="row between"><h3>' + (weak ? 'Follow-up question' : 'Diagnostic check') + ' ' + pr.number + ' of up to ' + pr.total + '</h3><span class="badge">' + esc(pr.concept.name) + '</span></div>'
      + (weak ? '<div class="notice warn">' + ui.icon('info') + '<p class="small"><strong>Not sure yet.</strong> The evidence from your answer is weak (' + ui.pct(session.diagnosis.confidence) + '%), so I cannot tell what is missing. This question checks the most likely concept before anything is taught.</p></div>' : '<p class="muted small">A one-step question on the suspected concept only. It does not reveal the answer to your problem.</p>')
      + '<p class="math problem-text">' + fmt(pr.mcq.q) + '</p>' + mcq('opt', pr.mcq)
      + '<div><button class="btn primary" type="submit" data-fk="probe-submit">Submit probe answer</button></div></form>';
  }

  function slipCard(session) {
    const d = session.diagnosis;
    let next;
    if (d.category === 'CARELESS_SLIP') next = 'Re-check the last step of your working. Your mastery estimates were not changed.';
    else if (d.category === 'UNIT_ERROR') next = 'Re-check unit prefixes and conversions. One unit slip does not change mastery; a repeat will trigger a probe on unit conversion.';
    else next = 'No probe found a confirmed gap, so no mastery was lowered. Re-read the problem and try again.';
    return '<div class="card stack" style="--gap-y:12px"><p class="eyebrow">Next step</p><p>' + esc(next) + '</p><div><button class="btn primary" type="button" data-action="try-again" data-fk="retry">Try again</button></div></div>';
  }

  function gapCard(session) {
    const c = conceptOf(session, session.gap.conceptId);
    return '<div class="card stack" style="--gap-y:12px"><div class="row between"><h3 id="stage-title" tabindex="-1">Gap confirmed</h3><span class="badge gap"><span class="dot"></span>Confirmed gap</span></div>'
      + '<p><strong>' + esc(c.name) + '</strong>: the probe was missed and the mastery estimate fell to <span class="mono">' + ui.f2(session.gap.p) + '</span>, below the 0.45 threshold.</p>'
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
      return '<div class="card stack" style="--gap-y:14px">' + head + personal
        + '<div><p class="label">The idea</p><p class="math">' + fmt(L.explain) + '</p></div>'
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

  function demoGuide(session) {
    const labels = ['Submit the wrong attempt', 'Read the diagnosis, then answer the probe (fail it on purpose)', 'Recover: lesson, then practice', 'Solve the fresh verification problem', 'See mastery and the graph update', 'Retry the original problem and solve it'];
    const st = session ? session.state : 'READY';
    const verified = !!(session && session.result && session.result.verified);
    const cur = { READY: verified ? 5 : 0, ATTEMPT_SUBMITTED: 0, ERROR_CLASSIFIED: 1, PROBE_REQUIRED: 1, RETRY_REQUIRED: verified ? 5 : 1, GAP_CONFIRMED: 2, RECOVERY_REQUIRED: 2, RECOVERY_IN_PROGRESS: 2, VERIFICATION_REQUIRED: 3, MASTERY_VERIFIED: 4, ATTEMPT_CORRECT: 6 }[st];
    return '<aside class="card demo" aria-label="Judge demo guide"><div class="row between"><h3>Judge demo guide</h3><span class="badge gold">demo fixture</span></div>'
      + '<p class="small muted">The wrong attempt is a pre-written fixture. The diagnosis, probe, mastery numbers and graph are computed live by the rule-based engine. Nothing in this demo is AI-generated.</p>'
      + '<ol class="steps small">' + labels.map((l, i) => '<li' + (i === cur ? ' class="cur" aria-current="step"' : '') + (i < cur ? ' style="opacity:.55"' : '') + '>' + esc(l) + '</li>').join('') + '</ol>'
      + '<div class="row"><button class="btn sm" type="button" data-action="demo-reset">Reset demo data</button></div></aside>';
  }

  ui.stage = function (session, store, note) {
    const profile = store.profile();
    let body;
    if (!session || session.state === 'READY') {
      body = '<div class="card stack" style="--gap-y:10px"><h3 id="stage-title" tabindex="-1">What happens after you submit</h3><ol class="steps muted"><li>Your answer is checked deterministically.</li><li>If it is wrong, the error is classified: slip, unit error, or a suspected gap, with evidence.</li><li>A suspected gap is tested with a short probe before anything is taught.</li><li>Confirmed gaps get a short lesson, practice, and a fresh verification problem.</li></ol></div>';
    } else if (session.state === 'ATTEMPT_CORRECT') body = solvedCard(session);
    else if (session.state === 'PROBE_REQUIRED') body = diagnosisCard(session) + probeCard(session);
    else if (session.state === 'RETRY_REQUIRED') body = (session.diagnosis ? diagnosisCard(session) : '') + slipCard(session);
    else if (session.state === 'GAP_CONFIRMED') body = gapCard(session);
    else if (session.state === 'RECOVERY_REQUIRED') body = '<div class="card stack" style="--gap-y:12px"><h3 id="stage-title" tabindex="-1">The gap is still open</h3><p class="muted">Review the lesson again, then try another fresh problem.</p><div><button class="btn primary" type="button" data-action="start-recovery" data-fk="start-recovery">Return to the lesson</button></div></div>';
    else if (session.state === 'RECOVERY_IN_PROGRESS') body = recoveryCard(session, store);
    else if (session.state === 'VERIFICATION_REQUIRED') body = verificationCard(session);
    else if (session.state === 'MASTERY_VERIFIED') body = verifiedCard(session, store);
    else body = '<div class="card"><p>Working on it.</p></div>';
    return '<div class="stack" style="--gap-y:14px" aria-live="polite">' + noteHtml(note) + body + (profile.demo ? demoGuide(session) : '') + '</div>';
  };

  ui.noteHtml = noteHtml;
  ui.answerBox = answerBox;
  if (typeof module !== 'undefined' && module.exports) module.exports = ui.stage;
})(typeof window !== 'undefined' ? window : globalThis);
