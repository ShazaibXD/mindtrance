/* Knowledge gap map: interactive graph, legend, concept details, recovery action. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const ui = MT.ui;
  const { esc, fmt } = ui;

  function trackFrom(route) {
    const t = MT.data.track(route.params.track) || MT.data.track('eee-transformers');
    const sel = t.concepts.some((c) => c.id === route.params.concept) ? route.params.concept : t.target;
    return { track: t, selected: sel };
  }

  function details(track, selected, states) {
    const gr = MT.graph.build(track);
    const c = gr.byId.get(selected);
    const st = states[selected];
    const meta = ui.STATUS[st.status];
    const rec = ui.store.record(track.id, selected);
    const parents = gr.parents.get(selected);
    const kids = gr.children.get(selected);
    const row = (id, why, w, dir, meta) => {
      const n = gr.byId.get(id);
      const s = states[id];
      return '<li><div><button class="linkbtn" type="button" data-action="map-select" data-concept="' + esc(id) + '">' + esc(n.name) + '</button> ' + ui.badge(ui.STATUS[s.status].cls, ui.STATUS[s.status].short) + '<p class="small muted">' + fmt(why || (dir === 'up' ? 'Needed before ' + c.name : 'Depends on ' + c.name)) + '</p>' + (meta && meta.confidence < 0.6 ? '<p class="small"><span class="badge verify">uncertain relationship</span> Treated as a parallel foundation, not a strict order.</p>' : '') + '</div><span class="mono small faint" title="Dependency strength">' + w.toFixed(2) + '</span></li>';
    };
    const events = ui.store.events().filter((e) => e.trackId === track.id && e.conceptId === selected && ['OBSERVATION', 'LEARNING', 'MASTERY_VERIFIED'].includes(e.type)).slice(-4).reverse();
    let action = '';
    if (st.status === 'BLOCKED') {
      const b = st.blockedBy[0];
      action = '<div class="notice warn">' + ui.icon('lock') + '<div><strong>Blocked by ' + esc(gr.byId.get(b).name) + '</strong><p class="small">An upstream concept is a confirmed gap. Repair it first.</p><button class="btn sm" type="button" style="margin-top:8px" data-action="recover-concept" data-track="' + esc(track.id) + '" data-concept="' + esc(b) + '">Recover ' + esc(gr.byId.get(b).name) + '</button></div></div>';
    } else if (st.status !== 'MASTERED') {
      action = '<button class="btn primary" type="button" data-action="recover-concept" data-track="' + esc(track.id) + '" data-concept="' + esc(selected) + '">' + (st.status === 'CONFIRMED_GAP' ? 'Start recovery' : 'Recover and verify this concept') + '</button>';
    } else {
      action = '<p class="muted small">No action needed. Mastery is re-checked whenever you answer related questions.</p>';
    }
    return '<aside class="card stack" style="--gap-y:14px" aria-labelledby="det-h" aria-live="polite">'
      + '<div class="row between"><h2 id="det-h" class="h3">' + esc(c.name) + '</h2>' + ui.statusBadge(st.status) + '</div>'
      + '<p class="muted">' + fmt(c.desc) + '</p>'
      + '<div><div class="row between small"><span class="label">Mastery estimate</span><span class="mono">' + ui.f2(st.p) + '</span></div>' + ui.meter(st.p, meta.cls)
      + '<p class="hint">' + esc(meta.help) + ' ' + (rec.obs ? rec.obs + ' observation' + (rec.obs > 1 ? 's' : '') + ', ' + rec.fails + ' missed.' : 'No evidence yet: this is a starting assumption.') + '</p></div>'
      + action
      + '<div><p class="label">Prerequisites</p>' + (parents.length ? '<ul class="list small">' + parents.map((p) => row(p.id, p.why, p.weight, 'up', p)).join('') + '</ul>' : '<p class="muted small">Foundational: nothing upstream.</p>') + '</div>'
      + '<div><p class="label">Needed for</p>' + (kids.length ? '<ul class="list small">' + kids.map((k) => row(k.id, k.why, k.weight, 'down', k)).join('') + '</ul>' : '<p class="muted small">This is the target concept of the track.</p>') + '</div>'
      + (events.length ? '<div><p class="label">Recent evidence</p><ul class="list small">' + events.map((e) => '<li><span>' + esc(ui.describeEvent(e).text) + '</span><span class="faint">' + ui.ago(e.at) + '</span></li>').join('') + '</ul></div>' : '')
      + '<div class="row"><a class="btn sm" href="' + ui.link('workspace', { track: track.id, problem: track.problems[0].id }) + '">Open a problem on this track</a></div></aside>';
  }

  function render(route) {
    const { track, selected } = trackFrom(route);
    const states = ui.store.graphState(track.id);
    const opts = MT.data.domains.map((d) => {
      const ts = MT.data.tracksFor(d.id);
      return ts.length ? '<optgroup label="' + esc(d.name) + '">' + ts.map((t) => '<option value="' + esc(t.id) + '"' + (t.id === track.id ? ' selected' : '') + '>' + esc(t.topic) + '</option>').join('') + '</optgroup>' : '';
    }).join('');
    const legend = Object.entries(ui.STATUS).map(([k, m]) => '<li>' + ui.badge(m.cls, m.label, true) + '<span class="small faint">' + esc(m.help) + '</span></li>').join('');
    const table = '<table class="tbl"><caption class="sr-only">Concepts in this track</caption><thead><tr><th>Concept</th><th>Level</th><th>Status</th><th>Estimate</th></tr></thead><tbody>'
      + track.concepts.slice().sort((a, b) => a.level - b.level).map((c) => '<tr><td><button class="linkbtn" type="button" data-action="map-select" data-concept="' + esc(c.id) + '">' + esc(c.name) + '</button></td><td>' + ['', 'Foundational', 'Intermediate', 'Target'][c.level] + '</td><td>' + esc(ui.STATUS[states[c.id].status].label) + '</td><td class="mono">' + ui.f2(states[c.id].p) + '</td></tr>').join('') + '</tbody></table>';
    return '<div class="page-head"><div><p class="eyebrow">Knowledge gap map</p><h1 id="page-title" class="h1">' + esc(track.topic) + '</h1></div>'
      + '<div class="field" style="min-width:240px"><label for="map-track">Topic</label><select class="select" id="map-track" data-change="map-track">' + opts + '</select></div></div>'
      + '<div class="mapgrid"><div class="stack" style="--gap-y:12px">'
      + '<div class="card flat" style="padding:12px 16px"><div class="row between"><span class="small muted">Drag to pan, Ctrl or Cmd with the wheel to zoom, Tab to move between concepts. <span class="legend-line up"></span> upstream <span class="legend-line down"></span> downstream</span></div></div>'
      + MT.GraphView.html(track, states, { selected, key: 'map-' + track.id })
      + '<details><summary class="small muted">Status legend</summary><ul class="list-reset legend">' + legend + '</ul></details>'
      + '<details><summary class="small muted">Concept list (accessible alternative to the graph)</summary>' + table + '</details></div>'
      + details(track, selected, states) + '</div>';
  }

  ui.registerPage({
    name: 'map', title: 'Knowledge gap map', nav: { label: 'Gap map', icon: 'map', order: 3 }, render,
    mount: (root, route) => {
      const { track } = trackFrom(route);
      root.querySelectorAll('[data-gv-root]').forEach((el) => MT.GraphView.mount(el, { interactive: true, onSelect: (id) => { ui.focusAfter = '.gv-node[data-id="' + id + '"]'; ui.go(ui.link('map', { track: track.id, concept: id })); } }));
    },
  });
  ui.actions['map-track'] = (el) => ui.go(ui.link('map', { track: el.value }));
  ui.actions['map-select'] = (el) => { const { track } = trackFrom(ui.route); ui.focusAfter = '#det-h'; ui.go(ui.link('map', { track: track.id, concept: el.dataset.concept })); };
  if (typeof module !== 'undefined' && module.exports) module.exports = { render };
})(typeof window !== 'undefined' ? window : globalThis);
