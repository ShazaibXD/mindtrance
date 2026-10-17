/* Problem workspace: pick a problem, submit answer and working, follow the diagnostic loop. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const ui = MT.ui;
  const { esc, fmt } = ui;
  const DEFAULT_TRACK = 'eee-transformers';

  ui.busy = false;
  ui.wsError = '';
  ui.vError = '';
  ui.stageNote = null;

  function context(route) {
    const store = ui.store;
    let track; let def; let session = null;
    if (route.params.session) {
      session = store.getSession(route.params.session);
      if (!session) return { error: 'That session no longer exists. It may have been reset.' };
      track = MT.data.track(session.trackId);
      def = track && (track.problems.find((p) => p.id === session.problemId) || track.problems[0]);
    } else {
      track = MT.data.track(route.params.track || DEFAULT_TRACK);
      if (!track) return { error: 'Unknown topic "' + route.params.track + '".' };
      def = route.params.problem ? track.problems.find((p) => p.id === route.params.problem) : track.problems[0];
      if (!def) return { error: 'Unknown problem "' + route.params.problem + '".' };
      session = store.activeFor(track.id, def.id);
    }
    if (!track || !def) return { error: 'This session refers to content that no longer exists.' };
    return { track, def, session };
  }

  const wsLink = (track, problem) => ui.link('workspace', { track, problem });

  function selectors(ctx) {
    const domain = MT.data.domains.find((d) => d.id === ctx.track.domainId);
    const dOpts = MT.data.domains.filter((d) => MT.data.tracksFor(d.id).length).map((d) => '<option value="' + esc(d.id) + '"' + (d.id === domain.id ? ' selected' : '') + '>' + esc(d.name) + '</option>').join('');
    const tOpts = MT.data.tracksFor(domain.id).map((t) => '<option value="' + esc(t.id) + '"' + (t.id === ctx.track.id ? ' selected' : '') + '>' + esc(t.topic) + '</option>').join('');
    const pOpts = ctx.track.problems.map((p) => '<option value="' + esc(p.id) + '"' + (p.id === ctx.def.id ? ' selected' : '') + '>' + esc(p.title) + '</option>').join('');
    return '<div class="card"><div class="selectors">'
      + '<div class="field"><label for="sel-domain">Exam and subject</label><select class="select" id="sel-domain" data-change="ws-domain">' + dOpts + '</select></div>'
      + '<div class="field"><label for="sel-track">Topic</label><select class="select" id="sel-track" data-change="ws-track">' + tOpts + '</select></div>'
      + '<div class="field"><label for="sel-problem">Problem</label><select class="select" id="sel-problem" data-change="ws-problem">' + pOpts + '</select></div></div></div>';
  }

  function attemptCard(ctx, problem) {
    const s = ctx.session;
    const store = ui.store;
    const locked = MT.flow.lockedBy(store, ctx.track.id, ctx.def.id);
    const lockBanner = locked.length ? '<div class="notice bad" role="alert">' + ui.icon('lock') + '<div><strong>Locked until the gap is repaired</strong><p class="small">' + locked.map((id) => esc(ui.conceptName(ctx.track.id, id))).join(', ') + ' is a confirmed gap. Recover it, then verify, to unlock this problem.</p><button class="btn sm" type="button" style="margin-top:8px" data-action="recover-concept" data-track="' + esc(ctx.track.id) + '" data-concept="' + esc(locked[0]) + '">Start recovery</button></div></div>' : '';
    if (s && s.state !== 'READY') {
      if (!s.attempt) return '<div class="card stack"><h2 class="h3">Your attempt</h2><p class="muted">This session was opened from the knowledge map for recovery, so no attempt has been submitted yet.</p></div>';
      return '<div class="card stack" style="--gap-y:10px"><h2 class="h3">Your attempt</h2><div><p class="label">Final answer</p><pre class="quote">' + esc(s.attempt.answer) + '</pre></div>' + (s.attempt.working.trim() ? '<div><p class="label">Working</p><pre class="quote">' + esc(s.attempt.working) + '</pre></div>' : '') + '</div>';
    }
    const draftKey = ctx.track.id + ':' + ctx.def.id;
    const demoBtn = store.profile().demo && !ctx.track.custom && !locked.length ? '<button class="btn sm" type="button" data-action="demo-fill" data-fk="demo-fill">Fill in the demo wrong attempt</button>' : '';
    return '<form class="card stack" data-form="attempt" novalidate style="--gap-y:14px"><h2 class="h3">Your attempt</h2>' + lockBanner
      + ui.answerBox('a', problem, draftKey, ui.wsError)
      + '<div class="row"><button class="btn primary" type="submit" data-fk="attempt-submit"' + (locked.length || ui.busy ? ' aria-disabled="true" disabled' : '') + '>' + (ui.busy ? '<span class="spin" aria-hidden="true"></span>Reading your work' : 'Submit attempt') + '</button>' + demoBtn + '</div>'
      + (ui.busy ? '<p class="hint" role="status">Asking Gemini to read your answer.</p>' : '') + '</form>';
  }

  function render(route) {
    const ctx = context(route);
    if (ctx.error) return '<div class="empty"><h1 id="page-title" class="h2">Cannot open this problem</h1><p>' + esc(ctx.error) + '</p><a class="btn primary" href="' + ui.link('explore') + '">Browse problems</a></div>';
    const problem = MT.flow.originalProblem({ trackId: ctx.track.id, problemId: ctx.def.id });
    const store = ui.store;
    const note = ui.stageNote;
    const focusId = ctx.session && ctx.session.gap ? ctx.session.gap.conceptId : (ctx.session && ctx.session.diagnosis && ctx.session.diagnosis.candidates && ctx.session.diagnosis.candidates[ctx.session.probeIndex || 0] ? ctx.session.diagnosis.candidates[ctx.session.probeIndex || 0].id : ctx.track.target);
    return '<div class="page-head"><div><p class="eyebrow">Problem workspace</p><h1 id="page-title" class="h1">' + fmt(ctx.def.title) + '</h1></div><div class="row"><span class="badge gold">' + esc(ctx.track.exam) + '</span><span class="badge">' + esc(ctx.track.subject) + '</span><span class="badge">' + esc(ctx.def.difficulty) + '</span></div></div>'
      + '<div class="ws"><div class="stack" style="--gap-y:16px">' + selectors(ctx)
      + '<section class="card" aria-labelledby="prob-h"><p class="eyebrow" id="prob-h">Problem</p><p class="problem-text math">' + fmt(problem.statement) + '</p></section>'
      + attemptCard(ctx, problem) + '</div>'
      + '<div class="stack" style="--gap-y:16px" id="stage">' + ui.stage(ctx.session, store, note)
      + '<section class="card" aria-labelledby="mini-h"><div class="card-head"><h2 class="h3" id="mini-h">Where this sits in the graph</h2><a class="small" href="' + ui.link('map', { track: ctx.track.id, concept: focusId }) + '">Open full map</a></div>'
      + MT.GraphView.html(ctx.track, store.graphState(ctx.track.id), { compact: true, key: 'ws-' + ctx.track.id, selected: focusId }) + '</section></div></div>';
  }

  ui.registerPage({
    name: 'workspace', title: 'Problem workspace', nav: { label: 'Workspace', icon: 'workspace', order: 2 }, render,
    mount: (root) => {
      ui.stageNote = null;
      root.querySelectorAll('[data-gv-root]').forEach((el) => MT.GraphView.mount(el, { interactive: false }));
    },
  });

  /* ---------- helpers ---------- */
  const sessionLink = (id) => ui.link('workspace', { session: id });
  const fixture = (track, problem) => {
    if (track.id === 'eee-transformers' && problem.id === 'tx-secondary-current') {
      return { answer: '200 A', working: 'N1/N2 = 10\nV2 = V1 x N1/N2 = 240 x 10 = 2400 V\nI2 = V2/RL = 2400/12 = 200 A' };
    }
    const p = MT.data.instantiate(problem, MT.flow.ORIGINAL_SEED);
    const pat = p.patterns.find((x) => x.cat === 'PREREQUISITE_GAP') || p.patterns[0];
    return { answer: p.answer.kind === 'expr' ? pat.expr : pat.value + (p.answer.unit ? ' ' + p.answer.unit : ''), working: '' };
  };
  const cname = (session, id) => ui.conceptName(session.trackId, id);
  const note = (kind, html) => { ui.stageNote = { kind, html }; };

  /* ---------- selector actions ---------- */
  ui.actions['ws-domain'] = (el) => { const t = MT.data.tracksFor(el.value)[0]; ui.go(wsLink(t.id, t.problems[0].id)); };
  ui.actions['ws-track'] = (el) => { const t = MT.data.track(el.value); ui.go(wsLink(t.id, t.problems[0].id)); };
  ui.actions['ws-problem'] = (el) => { const ctx = context(ui.route); ui.go(wsLink(ctx.track.id, el.value)); };

  /* ---------- attempt ---------- */
  ui.forms.attempt = async (form) => {
    const ctx = context(ui.route);
    if (ctx.error || ui.busy) return;
    const answer = form.elements.answer.value;
    const working = form.elements.working.value;
    const problem = MT.flow.originalProblem({ trackId: ctx.track.id, problemId: ctx.def.id });
    const pre = MT.diagnose.classify(ctx.track, problem, answer, working);
    ui.wsError = '';
    if (pre.category === 'INVALID_INPUT') { ui.wsError = pre.reason; ui.focusAfter = '#a-ans'; ui.render(); return; }
    if (MT.flow.lockedBy(ui.store, ctx.track.id, ctx.def.id).length) { ui.toast('This problem is locked until the gap is repaired.', 'bad'); return; }

    let override;
    let judgement;
    let aiNote = '';
    const cfg = ui.store.settings();
    if (problem.answer.kind === 'open') {
      if (ctx.track.source === 'fixture') {
        judgement = MT.custom.fixtureJudge(answer + ' ' + working);
      } else {
        if (!cfg.geminiKey) { ui.wsError = 'Judging an open-ended answer needs a Gemini key. Add one in Settings.'; ui.focusAfter = '#a-ans'; ui.render(); return; }
        ui.busy = true; ui.render();
        const r = await MT.ai.judgeOpen({ apiKey: cfg.geminiKey }, ctx.track, ctx.track.question, answer, working);
        ui.busy = false;
        if (!r.ok) { ui.wsError = r.error; ui.focusAfter = '#a-ans'; ui.render(); return; }
        judgement = r.value;
      }
    } else if (cfg.useGemini && cfg.geminiKey && pre.matchedBy === 'fallback' && pre.category !== 'CORRECT') {
      ui.busy = true; ui.render();
      const r = await MT.ai.classify({ apiKey: cfg.geminiKey }, ctx.track, problem, answer, working);
      ui.busy = false;
      if (r.ok) override = r.value; else aiNote = '<p class="small">' + esc(r.error) + '</p>';
    }
    const session = MT.flow.startSession(ui.store, ctx.track.id, ctx.def.id);
    const res = MT.flow.submitAttempt(ui.store, session.id, answer, working, { override, judgement });
    if (!res.ok) { ui.wsError = res.error; ui.render(); return; }
    if (aiNote) note('info', '<strong>Gemini was not used.</strong>' + aiNote);
    else if (override) note('info', '<strong>The rule-based engine had no signature for this answer, so Gemini classified it.</strong><p class="small">Its output was validated against the schema and the knowledge graph. Correctness was still checked deterministically.</p>');
    ui.focusAfter = '#stage-title';
    ui.go(sessionLink(session.id));
  };

  /* ---------- probe ---------- */
  ui.forms.probe = (form) => {
    const ctx = context(ui.route);
    if (!ctx.session) return;
    const idx = Number(form.elements.opt.value);
    const prior = MT.flow.currentProbe(ctx.session);
    const r = MT.flow.answerProbe(ui.store, ctx.session.id, idx);
    if (!r.ok) { ui.toast(r.error, 'bad'); return; }
    const nm = esc(prior.concept.name);
    const nums = ' Estimate ' + ui.f2(r.entry.before) + ' to ' + ui.f2(r.entry.after) + '.';
    if (r.outcome === 'GAP_CONFIRMED') note('warn', '<strong>Probe missed: gap confirmed in ' + nm + '.</strong><p class="small">' + nums + ' It is now below the 0.45 threshold.</p>');
    else if (r.outcome === 'NEXT_PROBE' && r.correct) note('good', '<strong>Probe passed: ' + nm + ' is probably not the cause.</strong><p class="small">' + nums + ' Checking the next hypothesis.</p>');
    else if (r.outcome === 'NEXT_PROBE') note('info', '<strong>Probe missed, but one miss is not enough to confirm a gap in ' + nm + '.</strong><p class="small">' + nums + ' Checking the next hypothesis.</p>');
    else note('info', '<strong>No prerequisite gap was confirmed.</strong><p class="small">' + nums + ' Nothing was lowered below the threshold. Re-read the problem and try again.</p>');
    ui.focusAfter = '#stage-title';
    ui.render();
  };

  /* ---------- recovery ---------- */
  ui.actions['start-recovery'] = () => { const ctx = context(ui.route); MT.flow.beginRecovery(ui.store, ctx.session.id); ui.focusAfter = '#stage-title'; ui.render(); };
  ui.actions['lesson-done'] = () => {
    const ctx = context(ui.route);
    const r = MT.flow.completeLesson(ui.store, ctx.session.id);
    if (r.ok) note('good', '<strong>Lesson complete.</strong><p class="small">Learning credited once: estimate ' + ui.f2(r.learn.before) + ' to ' + ui.f2(r.learn.after) + '. Now show it works.</p>');
    ui.focusAfter = '#stage-title'; ui.render();
  };
  ui.forms.practice = (form) => {
    const ctx = context(ui.route);
    const r = MT.flow.answerPractice(ui.store, ctx.session.id, Number(form.elements.opt.value));
    if (!r.ok) { ui.toast(r.error, 'bad'); return; }
    const nums = ' Estimate ' + ui.f2(r.observation.before) + ' to ' + ui.f2(r.observation.after) + '.';
    note(r.correct ? 'good' : 'bad', '<strong>' + (r.correct ? 'Correct.' : 'Not quite.') + '</strong><p class="small">' + fmt(r.feedback) + nums + '</p>');
    ui.focusAfter = '#stage-title'; ui.render();
  };
  ui.actions['to-verification'] = () => { const ctx = context(ui.route); const r = MT.flow.startVerification(ui.store, ctx.session.id); if (!r.ok) ui.toast(r.error, 'bad'); ui.focusAfter = '#stage-title'; ui.render(); };

  /* ---------- verification ---------- */
  ui.forms.verify = (form) => {
    const ctx = context(ui.route);
    const s = ctx.session;
    const choice = form.elements.opt;
    const answer = choice ? choice.value : form.elements.answer.value;
    ui.vError = '';
    const r = MT.flow.submitVerification(ui.store, s.id, answer, form.elements.working ? form.elements.working.value : '');
    if (!r.ok) { ui.vError = r.error; ui.focusAfter = '#v-ans'; ui.render(); return; }
    if (!choice) ui.drafts['ans:v:' + s.id + ':' + s.verification.seed] = '';
    const nm = esc(cname(s, s.gap.conceptId));
    if (r.outcome === 'VERIFIED') note('good', '<strong>Verified.</strong><p class="small">Estimate ' + ui.f2(r.before) + ' to ' + ui.f2(r.after) + '.</p>');
    else if (r.outcome === 'NEEDS_MORE') note('info', '<strong>Correct, but one success is not enough yet.</strong><p class="small">The estimate for ' + nm + ' is ' + ui.f2(r.after) + ', below 0.80. Here is another fresh problem.</p>');
    else if (r.outcome === 'SAME_GAP') note('bad', '<strong>The same gap showed up again.</strong><p class="small">' + r.diagnosis.evidence.map(fmt).join(' ') + ' Back to the lesson.</p>');
    else note('info', '<strong>That answer shows a different kind of error.</strong><p class="small">' + fmt(r.diagnosis.evidence[0] || '') + ' No penalty to ' + nm + '. Try this fresh problem.</p>');
    ui.focusAfter = '#stage-title'; ui.render();
  };

  ui.actions['try-again'] = () => {
    const ctx = context(ui.route);
    const s = ctx.session;
    const clearDrafts = (s.result && s.result.verified) || s.state === 'ATTEMPT_CORRECT';
    MT.flow.tryAgain(ui.store, s.id);
    if (clearDrafts) { delete ui.drafts['ans:' + ctx.track.id + ':' + ctx.def.id]; delete ui.drafts['wrk:' + ctx.track.id + ':' + ctx.def.id]; }
    ui.wsError = ''; ui.focusAfter = '#a-ans';
    ui.go(wsLink(ctx.track.id, ctx.def.id));
  };

  /* ---------- demo ---------- */
  ui.actions['demo-fill'] = () => {
    const ctx = context(ui.route);
    const f = fixture(ctx.track, ctx.def);
    const k = ctx.track.id + ':' + ctx.def.id;
    ui.drafts['ans:' + k] = f.answer; ui.drafts['wrk:' + k] = f.working;
    ui.focusAfter = '[data-fk="attempt-submit"]'; ui.render();
  };
  ui.actions['demo-reset'] = async () => {
    const ok = await ui.confirm({ title: 'Reset demo data?', body: 'This clears mastery, events and sessions for the judge demo profile so you can run it again from the start.', confirmLabel: 'Reset', danger: true });
    if (!ok) return;
    ui.store.resetProgress(); ui.drafts = {}; ui.wsError = ''; ui.stageNote = null;
    ui.go(wsLink('eee-transformers', 'tx-secondary-current'));
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = { render };
})(typeof window !== 'undefined' ? window : globalThis);
