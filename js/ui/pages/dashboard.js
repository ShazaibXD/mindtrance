/* Student dashboard: real persisted data only. New profiles see empty states, not sample numbers. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const ui = MT.ui;
  const { esc } = ui;

  const problemTitle = (trackId, problemId) => {
    const p = MT.data.problem(trackId, problemId);
    return p ? p.title : 'a problem';
  };

  function summarise(store) {
    const started = new Set(store.sessionList().map((s) => s.trackId));
    const out = { mastered: 0, verify: 0, gaps: 0, tracks: [], gapList: [] };
    for (const t of MT.data.tracks) {
      const gs = store.graphState(t.id);
      const ps = t.concepts.map((c) => gs[c.id].p);
      const avg = ps.reduce((a, b) => a + b, 0) / ps.length;
      out.tracks.push({ track: t, avg, started: started.has(t.id) });
      if (!started.has(t.id)) continue;
      for (const c of t.concepts) {
        const st = gs[c.id].status;
        if (st === 'MASTERED') out.mastered++;
        else if (['NEEDS_VERIFICATION', 'SUSPECTED_GAP', 'LEARNING_IN_PROGRESS', 'READY_FOR_REASSESSMENT'].includes(st)) out.verify++;
        else if (st === 'CONFIRMED_GAP') { out.gaps++; out.gapList.push({ track: t, concept: c, p: gs[c.id].p }); }
      }
    }
    return out;
  }

  function nextActionCard(store) {
    const a = MT.flow.nextAction(store);
    if (a.kind === 'continue') {
      const s = a.session;
      return { title: 'Continue: ' + problemTitle(s.trackId, s.problemId), body: ui.STATE_LABEL[s.state] + '. Pick up exactly where you left off.', cta: '<a class="btn primary" href="' + ui.link('workspace', { session: s.id }) + '">Continue learning ' + ui.icon('arrow', 16) + '</a>' };
    }
    if (a.kind === 'recover') {
      return { title: 'Repair a confirmed gap', body: ui.conceptName(a.trackId, a.conceptId) + ' is a confirmed gap, so related problems stay locked until it is recovered and verified.', cta: '<button class="btn primary" type="button" data-action="recover-concept" data-track="' + esc(a.trackId) + '" data-concept="' + esc(a.conceptId) + '">Start recovery ' + ui.icon('arrow', 16) + '</button>' };
    }
    if (a.kind === 'review') {
      return { title: 'Spaced review: ' + ui.conceptName(a.trackId, a.conceptId), body: a.reason === 'escalated' ? 'You stepped back from this earlier. A short refresher now helps it stick.' : 'You verified this a while ago. Estimates drift back without practice, so a quick check keeps it solid.', cta: '<button class="btn primary" type="button" data-action="recover-concept" data-track="' + esc(a.trackId) + '" data-concept="' + esc(a.conceptId) + '">Start the review ' + ui.icon('arrow', 16) + '</button>' };
    }
    return { title: 'Try: ' + problemTitle(a.trackId, a.problemId), body: 'A new problem you have not attempted yet. Submit your working too: it is part of the evidence.', cta: '<a class="btn primary" href="' + ui.link('workspace', { track: a.trackId, problem: a.problemId }) + '">Open problem ' + ui.icon('arrow', 16) + '</a>' };
  }

  function render() {
    const store = ui.store;
    const profile = store.profile();
    const sum = summarise(store);
    const events = store.events();
    const attempts = events.filter((e) => e.type === 'ATTEMPT');
    const solved = attempts.filter((e) => e.correct).length;
    const sessions = store.sessionList();
    const na = nextActionCard(store);
    const due = store.dueReviews();
    const recoveries = sessions.filter((s) => s.gap).slice(0, 4);
    const recent = events.slice(-7).reverse();
    const hasActivity = sessions.length > 0;

    const tiles = [
      ['Problems attempted', attempts.length, solved + ' solved', ''],
      ['Concepts mastered', sum.mastered, 'provisional, with at least two answers on record', 'mastered'],
      ['Need verification', sum.verify, 'some evidence, or a possible gap', 'verify'],
      ['Confirmed gaps', sum.gaps, 'probe failed, estimate below 0.45', 'gap'],
    ].map((t) => '<div class="card stat"><span class="num ' + t[3] + '-text" data-count="' + t[1] + '">' + t[1] + '</span><span class="cap"><strong>' + t[0] + '</strong><br><span class="faint">' + t[2] + '</span></span></div>').join('');

    return '<div class="page-head"><div><p class="eyebrow">' + (profile.demo ? 'Judge demo profile' : 'Dashboard') + '</p><h1 id="page-title" class="h1">Welcome, ' + esc(profile.name) + '</h1></div></div>'
      + (hasActivity ? ui.intro('dashboard', 'What this page shows', '<p class="muted">Your next best step is at the top. The four numbers count concepts you have actually answered on. Below them, each topic shows how well you know it, which concepts are confirmed gaps, and what is due for review.</p>') : ui.firstRun())
      + '<section class="card next" aria-labelledby="next-h"><div><p class="eyebrow">Recommended next action</p><h2 id="next-h">' + esc(na.title) + '</h2><p class="muted">' + esc(na.body) + '</p></div><div>' + na.cta + '</div></section>'
      + '<div class="grid stats" role="list" aria-label="Summary">' + tiles + '</div>'
      + '<p class="faint small">Concepts you have not answered anything on are not counted. Estimates are not grades, and they fade back toward the starting assumption if you stop practising.</p>'
      + '<div class="grid two">'
      + '<section class="card" aria-labelledby="sub-h"><div class="card-head"><h2 id="sub-h">Subject-wise mastery</h2><span class="faint small">Mean estimate per track</span></div><ul class="list-reset subj">'
      + sum.tracks.map((r) => '<li><div class="row between"><span><strong>' + esc(r.track.topic) + '</strong><br><span class="faint small">' + esc(MT.data.domains.find((d) => d.id === r.track.domainId).name) + '</span></span><span class="mono ' + (r.started ? '' : 'faint') + '">' + (r.started ? ui.f2(r.avg) : 'not started') + '</span></div>' + ui.meter(r.avg, r.started ? (r.avg >= 0.8 ? 'mastered' : r.avg >= 0.45 ? 'verify' : 'gap') : 'idle') + '</li>').join('')
      + '</ul></section>'
      + '<div class="stack">'
      + '<section class="card" aria-labelledby="gap-h"><div class="card-head"><h2 id="gap-h">Confirmed gaps</h2></div>'
      + (sum.gapList.length ? '<ul class="list">' + sum.gapList.map((x) => '<li><span><strong>' + esc(x.concept.name) + '</strong><br><span class="faint small">' + esc(x.track.topic) + ' &middot; estimate ' + ui.f2(x.p) + '</span></span><button class="btn sm" type="button" data-action="recover-concept" data-track="' + esc(x.track.id) + '" data-concept="' + esc(x.concept.id) + '">Recover</button></li>').join('') + '</ul>' : '<p class="muted">None. Gaps appear here only after a probe fails.</p>')
      + '</section>'
      + '<section class="card" aria-labelledby="rv-h"><div class="card-head"><h2 id="rv-h">Due for review</h2></div>'
      + (due.length ? '<ul class="list">' + due.slice(0, 4).map((r) => '<li><span><strong>' + esc(ui.conceptName(r.trackId, r.conceptId)) + '</strong><br><span class="faint small">' + (r.reason === 'escalated' ? 'flagged after stepping back' : 'spaced review') + ' &middot; due ' + ui.ago(r.dueAt) + '</span></span><button class="btn sm" type="button" data-action="recover-concept" data-track="' + esc(r.trackId) + '" data-concept="' + esc(r.conceptId) + '">Review</button></li>').join('') + '</ul>' : '<p class="muted">Nothing is due. Verified concepts come back after about a week, and later each time you pass.</p>')
      + '</section>'
      + '<section class="card" aria-labelledby="rec-h"><div class="card-head"><h2 id="rec-h">Recent recovery sessions</h2></div>'
      + (recoveries.length ? '<ul class="list">' + recoveries.map((s) => '<li><span><strong>' + esc(ui.conceptName(s.trackId, s.gap.conceptId)) + '</strong><br><span class="faint small">' + esc(ui.STATE_LABEL[s.state]) + ' &middot; ' + ui.ago(s.updatedAt) + '</span></span><a class="btn sm" href="' + ui.link('workspace', { session: s.id }) + '">Open</a></li>').join('') + '</ul>' : '<p class="muted">No recovery sessions yet.</p>')
      + '</section></div></div>'
      + '<section class="card" aria-labelledby="act-h"><div class="card-head"><h2 id="act-h">Recent learning activity</h2><a href="' + ui.link('progress') + '" class="small">Full analytics</a></div>'
      + (recent.length ? '<ul class="list">' + recent.map((ev) => { const d = ui.describeEvent(ev); return '<li><span><span class="badge ' + d.tone + '">' + esc(ev.type.replace(/_/g, ' ').toLowerCase()) + '</span> ' + esc(d.text) + '</span><span class="faint small">' + ui.ago(ev.at) + '</span></li>'; }).join('') + '</ul>' : '<p class="muted">Nothing yet.</p>')
      + '</section>';
  }

  ui.registerPage({ name: 'dashboard', title: 'Dashboard', nav: { label: 'Dashboard', icon: 'dashboard', order: 1 }, render });
  ui.actions['recover-concept'] = (el) => {
    const s = MT.flow.startRecoveryFor(ui.store, el.dataset.track, el.dataset.concept);
    ui.go(ui.link('workspace', { session: s.id }));
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { render };
})(typeof window !== 'undefined' ? window : globalThis);
