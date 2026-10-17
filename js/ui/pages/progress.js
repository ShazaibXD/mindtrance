/* Progress and analytics. All numbers come from the learning event log. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const ui = MT.ui;
  const { esc, fmt } = ui;
  const A = MT.analytics;

  const empty = (text) => '<div class="empty"><p>' + esc(text) + '</p></div>';

  function render() {
    const store = ui.store;
    const events = store.events();
    const mo = A.masteryOverTime(events);
    const attempts = A.attemptSeries(events);
    const trend = A.correctnessTrend(attempts, 5);
    const rec = A.recoveryStats(events);
    const mis = A.repeatedMisconceptions(events);
    const weak = A.weakest(store, 5);
    const mastered = A.recentlyMastered(events, 5);

    const moChart = mo.length
      ? ui.charts.line(mo.map((p, i) => ({ x: i, y: p.mean })), { label: 'Mean mastery estimate over ' + mo.length + ' updates, ending at ' + ui.f2(mo[mo.length - 1].mean), xLabel: 'Estimate updates (answers and lessons)', thresholds: [{ y: 0.8, label: 'mastered', cls: 'ok' }, { y: 0.45, label: 'gap', cls: 'bad' }] })
        + '<details><summary class="small muted">Data table</summary><table class="tbl small"><thead><tr><th>Update</th><th>Concepts touched</th><th>Mean estimate</th></tr></thead><tbody>' + mo.map((p, i) => '<tr><td>' + (i + 1) + ' (' + (p.type === 'LEARNING' ? 'lesson' : 'answer') + ')</td><td>' + p.touched + '</td><td class="mono">' + ui.f2(p.mean) + '</td></tr>').join('') + '</tbody></table></details>'
      : empty('No estimate updates yet. Answer a probe, practice or verification question to start the curve.');

    const attChart = attempts.length
      ? ui.charts.attemptStrip(attempts) + '<h3 class="h3" style="margin-top:14px">Correctness trend</h3>' + ui.charts.line(trend.map((t) => ({ x: t.i, y: t.rate })), { label: 'Share of correct attempts over a window of the last 5, ending at ' + ui.pct(trend[trend.length - 1].rate) + ' percent', xLabel: 'Attempt number (rolling 5)' })
      : empty('No attempts yet.');

    const bySubject = MT.data.tracks.map((t) => {
      const recs = t.concepts.map((c) => store.record(t.id, c.id));
      const withEv = recs.filter((r) => r.obs > 0).length;
      const avg = recs.reduce((s, r) => s + r.p, 0) / recs.length;
      return '<li><div class="row between"><span><strong>' + esc(t.topic) + '</strong><br><span class="faint small">' + withEv + ' of ' + t.concepts.length + ' concepts have evidence</span></span><span class="mono">' + ui.f2(avg) + '</span></div>' + ui.meter(avg, avg >= 0.8 ? 'mastered' : avg >= 0.45 ? 'verify' : 'gap') + '</li>';
    }).join('');

    return '<div class="page-head"><div><p class="eyebrow">Progress and analytics</p><h1 id="page-title" class="h1">How your understanding is changing</h1></div></div>'
      + '<div class="notice info">' + ui.icon('info') + '<p class="small"><strong>These are estimates, not grades.</strong> Mastery uses Bayesian Knowledge Tracing with fixed parameters (slip 0.10, guess 0.20, learning 0.25) that have not been calibrated on real student data. With only a few answers per concept, a single result can move an estimate a lot.</p></div>'
      + '<section class="card" aria-labelledby="mo-h"><div class="card-head"><h2 id="mo-h">Mastery over time</h2><span class="faint small">Mean across concepts touched</span></div>' + moChart + '</section>'
      + '<section class="card" aria-labelledby="at-h"><div class="card-head"><h2 id="at-h">Attempts and correctness</h2><span class="faint small">' + attempts.length + ' attempt' + (attempts.length === 1 ? '' : 's') + '</span></div>' + attChart + '</section>'
      + '<div class="grid two">'
      + '<section class="card" aria-labelledby="rc-h"><div class="card-head"><h2 id="rc-h">Recovery success</h2></div>'
      + (rec.started ? '<div class="grid" style="grid-template-columns:repeat(3,1fr)"><div class="stat"><span class="num">' + rec.started + '</span><span class="cap">started</span></div><div class="stat"><span class="num mastered-text">' + rec.verified + '</span><span class="cap">verified</span></div><div class="stat"><span class="num gap-text">' + rec.failed + '</span><span class="cap">verification failed</span></div></div><p class="muted small" style="margin-top:10px">' + (rec.rate != null ? ui.pct(rec.rate) + '% of started recoveries reached verified mastery.' : '') + '</p>' : empty('No recovery sessions yet.'))
      + '</section>'
      + '<section class="card" aria-labelledby="mi-h"><div class="card-head"><h2 id="mi-h">Repeated misconceptions</h2></div>'
      + (mis.length ? '<ul class="list">' + mis.slice(0, 5).map((m) => { const c = MT.data.track(m.trackId).concepts.find((x) => x.id === m.conceptId); return '<li><span><strong>' + esc(c.name) + '</strong><br><span class="small muted">' + fmt(c.lesson.misconception) + '</span></span><span class="badge ' + (m.count > 1 ? 'gap' : '') + '">' + m.count + (m.count > 1 ? ' times' : ' time') + '</span></li>'; }).join('') + '</ul>' : '<p class="muted">None logged. Misconceptions appear after a diagnosed error points at a concept.</p>')
      + '</section></div>'
      + '<div class="grid two">'
      + '<section class="card" aria-labelledby="wk-h"><div class="card-head"><h2 id="wk-h">Weakest concepts with evidence</h2></div>'
      + (weak.length ? '<ul class="list">' + weak.map((r) => '<li style="display:block"><div class="row between"><span><strong>' + esc(r.concept.name) + '</strong><br><span class="faint small">' + r.fails + ' missed of ' + r.obs + ' answered</span></span><span class="mono">' + ui.f2(r.p) + '</span></div>' + ui.meter(r.p, r.p >= 0.8 ? 'mastered' : r.p >= 0.45 ? 'verify' : 'gap') + '</li>').join('') + '</ul>' : '<p class="muted">Concepts show up here once you have answered something on them.</p>')
      + '</section>'
      + '<section class="card" aria-labelledby="rm-h"><div class="card-head"><h2 id="rm-h">Recently mastered</h2></div>'
      + (mastered.length ? '<ul class="list">' + mastered.map((e) => '<li><span><strong>' + esc(ui.conceptName(e.trackId, e.conceptId)) + '</strong><br><span class="small muted">' + ui.f2(e.before) + ' to ' + ui.f2(e.after) + '</span></span><span class="faint small">' + ui.ago(e.at) + '</span></li>').join('') + '</ul>' : '<p class="muted">Nothing verified yet.</p>')
      + '</section></div>'
      + '<section class="card" aria-labelledby="sj-h"><div class="card-head"><h2 id="sj-h">Subject-level progress</h2><span class="faint small">Mean estimate including starting assumptions</span></div><ul class="list-reset subj">' + bySubject + '</ul></section>';
  }

  ui.registerPage({ name: 'progress', title: 'Progress', nav: { label: 'Progress', icon: 'progress', order: 4 }, render });
  if (typeof module !== 'undefined' && module.exports) module.exports = { render };
})(typeof window !== 'undefined' ? window : globalThis);
