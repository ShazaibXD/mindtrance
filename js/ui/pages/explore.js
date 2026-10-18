/* Domain and question explorer: browse every exam domain, topic and problem. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const ui = MT.ui;
  const { esc } = ui;
  ui.exploreFilter = 'all';

  function render() {
    const store = ui.store;
    const f = ui.exploreFilter;
    const shown = MT.data.domains.filter((d) => !d.dynamic || MT.data.tracksFor(d.id).length);
    const chips = [['all', 'All domains']].concat(shown.map((d) => [d.id, d.name])).map(([id, name]) => '<button class="chip" type="button" data-action="explore-filter" data-id="' + esc(id) + '" aria-pressed="' + (f === id) + '" data-fk="chip-' + esc(id) + '">' + esc(name) + '</button>').join('');
    const domains = shown.filter((d) => f === 'all' || f === d.id).map((d) => {
      const tracks = MT.data.tracksFor(d.id);
      return '<section class="stack" style="--gap-y:12px" aria-labelledby="d-' + esc(d.id) + '"><div><h2 id="d-' + esc(d.id) + '" class="h2" style="margin-bottom:2px">' + esc(d.name) + '</h2><p class="muted small">' + esc(d.blurb) + '</p></div>'
        + (tracks.length ? tracks.map((t) => {
          const gs = store.graphState(t.id);
          const probs = t.problems.map((p) => {
            const st = gs[p.target];
            return '<li><div><strong>' + ui.fmt(p.title) + '</strong><br><span class="faint small">' + esc(p.difficulty) + ' &middot; target concept: ' + esc(t.concepts.find((c) => c.id === p.target).name) + '</span></div><div class="row">' + ui.badge(ui.STATUS[st.status].cls, ui.STATUS[st.status].short) + '<a class="btn sm primary" href="' + ui.link('workspace', { track: t.id, problem: p.id }) + '">Open</a></div></li>';
          }).join('');
          return '<article class="card"><div class="card-head"><div><h3 class="h3">' + esc(t.topic) + '</h3><p class="faint small">' + esc(t.subject) + ' &middot; ' + esc(t.exam) + '</p></div><a class="btn sm" href="' + ui.link('map', { track: t.id }) + '">Gap map</a></div><p class="muted">' + esc(t.blurb) + '</p><p class="faint small" style="margin:8px 0">' + t.concepts.length + ' concepts &middot; ' + t.problems.length + ' original problem' + (t.problems.length > 1 ? 's' : '') + ' &middot; ' + t.verification.length + ' fresh-problem generators</p><ul class="list">' + probs + '</ul></article>';
        }).join('') : '<div class="empty"><p>No tracks yet for this domain.</p></div>') + '</section>';
    }).join('');
    return '<div class="page-head"><div><p class="eyebrow">Question and domain explorer</p><h1 id="page-title" class="h1">Browse the tracks</h1></div></div>'
      + ui.intro('explore', 'What you can open here', '<p class="muted">Every topic MINDTRACE knows, grouped by exam or subject. Open a problem to try it, or open its Gap map to see the concepts behind it. The badge on a problem shows where you stand on its target concept.</p>')
      + '<div class="chips" role="group" aria-label="Filter by domain">' + chips + '</div>' + domains
      + '<p class="faint small">Each track is a data file: concepts, prerequisite edges, problems with error signatures, and verification generators. Adding a new one does not touch the engine. See docs/ARCHITECTURE.md.</p>';
  }

  ui.registerPage({ name: 'explore', title: 'Explorer', nav: { label: 'Explorer', icon: 'explore', order: 5 }, render });
  ui.actions['explore-filter'] = (el) => { ui.exploreFilter = el.dataset.id; ui.render(); };
  if (typeof module !== 'undefined' && module.exports) module.exports = { render };
})(typeof window !== 'undefined' ? window : globalThis);
