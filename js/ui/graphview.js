/* Interactive SVG knowledge graph: status colours, dependency highlighting, pan, zoom, fit, keyboard. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const U = MT.ui;
  const NODE_W = 168;
  const NODE_H = 64;
  const views = {}; // remembered pan/zoom per graph key

  function wrapName(name) {
    const words = String(name).split(' ');
    const lines = [''];
    for (const w of words) {
      const cur = lines[lines.length - 1];
      if ((cur + ' ' + w).trim().length <= 19 || !cur) lines[lines.length - 1] = (cur + ' ' + w).trim();
      else lines.push(w);
    }
    if (lines.length > 2) { lines.length = 2; lines[1] = lines[1].replace(/.{0,2}$/, '') + '…'; }
    return lines;
  }

  /* Returns the graph markup. `states` comes from store.graphState. */
  function html(track, states, opts) {
    const o = Object.assign({ selected: null, compact: false, key: track.id }, opts || {});
    const gr = MT.graph.build(track);
    const { pos, width, height } = MT.graph.layout(gr, { nodeW: NODE_W, nodeH: NODE_H, colGap: 204, rowGap: 124, pad: 36 });
    const sel = o.selected && gr.byId.has(o.selected) ? o.selected : null;
    const up = sel ? new Set([sel, ...MT.graph.ancestors(gr, sel).keys()]) : null;
    const down = sel ? new Set([sel, ...MT.graph.descendants(gr, sel)]) : null;
    const marker = 'arrow-' + o.key;

    const slotX = (id, list, who) => {
      const sorted = list.slice().sort((a, b) => pos[a.id].x - pos[b.id].x);
      const i = sorted.findIndex((e) => e.id === who);
      return pos[id].x + (NODE_W * (i + 1)) / (sorted.length + 1);
    };
    let edges = '';
    for (const c of track.concepts) {
      for (const par of gr.parents.get(c.id)) {
        const x1 = slotX(par.id, gr.children.get(par.id), c.id);
        const y1 = pos[par.id].y + NODE_H;
        const x2 = slotX(c.id, gr.parents.get(c.id), par.id);
        const y2 = pos[c.id].y;
        const dy = Math.max(30, (y2 - y1) / 2);
        let cls = 'gv-edge';
        if (sel) {
          if (up.has(par.id) && up.has(c.id)) cls += ' hl-up';
          else if (down.has(par.id) && down.has(c.id)) cls += ' hl-down';
          else cls += ' dim';
        }
        if (states[par.id].status === 'CONFIRMED_GAP' && (states[c.id].status === 'BLOCKED' || states[c.id].status === 'CONFIRMED_GAP')) cls += ' broken';
        edges += '<path class="' + cls + '" d="M' + x1 + ' ' + y1 + ' C' + x1 + ' ' + (y1 + dy) + ' ' + x2 + ' ' + (y2 - dy) + ' ' + x2 + ' ' + y2 + '" stroke-width="' + (1 + par.weight * 2).toFixed(1) + '" marker-end="url(#' + marker + ')"><title>' + U.esc(gr.byId.get(par.id).name + ' is a prerequisite of ' + c.name + ' (strength ' + par.weight + ')') + '</title></path>';
      }
    }

    let nodes = '';
    for (const c of track.concepts) {
      const st = states[c.id];
      const meta = U.STATUS[st.status];
      const p = pos[c.id];
      const lines = wrapName(c.name);
      const isSel = sel === c.id;
      const dim = sel && !up.has(c.id) && !down.has(c.id);
      const isTarget = c.id === track.target;
      const label = meta.label + (isTarget ? ' · target' : '');
      nodes += '<g class="gv-node st-' + st.status + (isSel ? ' sel' : '') + (dim ? ' dim' : '') + (isTarget ? ' target' : '') + '" data-id="' + U.esc(c.id) + '" transform="translate(' + p.x + ' ' + p.y + ')"'
        + ' tabindex="0" role="button" aria-pressed="' + isSel + '" aria-label="' + U.esc(c.name + ', ' + label + ', mastery estimate ' + U.f2(st.p)) + '">'
        + '<rect width="' + NODE_W + '" height="' + NODE_H + '" rx="10"/>'
        + '<circle class="glyph-bg" cx="18" cy="19" r="9"/><text class="glyph" x="18" y="23" text-anchor="middle">' + meta.glyph + '</text>'
        + '<text class="name" x="36" y="' + (lines.length > 1 ? 18 : 23) + '">' + U.esc(lines[0]) + '</text>'
        + (lines[1] ? '<text class="name" x="36" y="32">' + U.esc(lines[1]) + '</text>' : '')
        + '<text class="lab" x="12" y="55">' + U.esc(meta.short + (isTarget ? ' \u00b7 target' : '')) + '</text>'
        + '<text class="pval" x="' + (NODE_W - 10) + '" y="55" text-anchor="end">' + U.f2(st.p) + '</text>'
        + '</g>';
    }

    const controls = o.compact ? '' : '<div class="gv-controls" role="group" aria-label="Graph view controls">'
      + '<button class="btn sm" type="button" data-gv="zoom-in" aria-label="Zoom in">' + U.icon('plus', 16) + '</button>'
      + '<button class="btn sm" type="button" data-gv="zoom-out" aria-label="Zoom out">' + U.icon('minus', 16) + '</button>'
      + '<button class="btn sm" type="button" data-gv="fit" aria-label="Fit graph to view">' + U.icon('fit', 16) + '</button></div>';

    return '<div class="gv' + (o.compact ? ' compact' : '') + '" data-gv-root data-key="' + U.esc(o.key) + '" data-w="' + width + '" data-h="' + height + '">'
      + '<svg class="gv-svg" role="group" aria-label="Prerequisite graph for ' + U.esc(track.topic) + '. Use Tab to move between concepts, Enter to select, arrow keys to pan, plus and minus to zoom." tabindex="' + (o.compact ? -1 : 0) + '">'
      + '<defs><marker id="' + marker + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="gv-arrow"/></marker></defs>'
      + '<g class="gv-viewport">' + edges + nodes + '</g></svg>' + controls + '</div>';
  }

  /* Attach pan, zoom and selection behaviour to a rendered graph. */
  function mount(root, opts) {
    const o = Object.assign({ onSelect: null, interactive: true }, opts || {});
    const svg = root.querySelector('.gv-svg');
    const vp = root.querySelector('.gv-viewport');
    const key = root.dataset.key;
    const W0 = Number(root.dataset.w);
    const H0 = Number(root.dataset.h);
    const view = views[key] || (views[key] = { k: 1, tx: 0, ty: 0, touched: false });

    const apply = () => vp.setAttribute('transform', 'translate(' + view.tx + ' ' + view.ty + ') scale(' + view.k + ')');
    function fit() {
      const r = svg.getBoundingClientRect();
      if (!r.width || !r.height) return;
      view.k = Math.min(r.width / W0, r.height / H0, o.interactive ? 1.25 : 1);
      view.tx = (r.width - W0 * view.k) / 2;
      view.ty = (r.height - H0 * view.k) / 2;
      apply();
    }
    function zoomAt(factor, cx, cy) {
      const nk = Math.min(2.5, Math.max(0.3, view.k * factor));
      const f = nk / view.k;
      view.tx = cx - (cx - view.tx) * f;
      view.ty = cy - (cy - view.ty) * f;
      view.k = nk;
      view.touched = true;
      apply();
    }
    const center = () => { const r = svg.getBoundingClientRect(); return [r.width / 2, r.height / 2]; };

    if (view.touched) apply(); else fit();
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(() => { if (!view.touched) fit(); });
      ro.observe(svg);
    }

    root.addEventListener('click', (e) => {
      if (root._dragged) { root._dragged = false; return; }
      const btn = e.target.closest('[data-gv]');
      if (btn) {
        const a = btn.dataset.gv;
        const [cx, cy] = center();
        if (a === 'zoom-in') zoomAt(1.25, cx, cy);
        else if (a === 'zoom-out') zoomAt(0.8, cx, cy);
        else if (a === 'fit') { view.touched = false; fit(); }
        return;
      }
      const n = e.target.closest('.gv-node');
      if (n && o.onSelect) o.onSelect(n.dataset.id);
    });

    if (!o.interactive) return;

    let drag = null;
    svg.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false };
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      drag.moved = true;
      view.tx = drag.tx + dx; view.ty = drag.ty + dy; view.touched = true;
      svg.classList.add('panning');
      apply();
    });
    const end = (e) => {
      if (!drag) return;
      root._dragged = drag.moved;
      drag = null;
      svg.classList.remove('panning');
      if (svg.hasPointerCapture && svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
      setTimeout(() => { root._dragged = false; }, 0);
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('wheel', (e) => {
      if (!(e.ctrlKey || e.metaKey)) return; // plain scrolling keeps scrolling the page
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.12 : 0.89, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    root.addEventListener('keydown', (e) => {
      const n = e.target.closest && e.target.closest('.gv-node');
      if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (o.onSelect) o.onSelect(n.dataset.id); return; }
      if (e.target !== svg) return;
      const step = 40;
      const [cx, cy] = center();
      if (e.key === 'ArrowLeft') view.tx += step;
      else if (e.key === 'ArrowRight') view.tx -= step;
      else if (e.key === 'ArrowUp') view.ty += step;
      else if (e.key === 'ArrowDown') view.ty -= step;
      else if (e.key === '+' || e.key === '=') return void zoomAt(1.2, cx, cy);
      else if (e.key === '-') return void zoomAt(0.83, cx, cy);
      else if (e.key === '0') { view.touched = false; return void fit(); }
      else return;
      e.preventDefault(); view.touched = true; apply();
    });
  }

  MT.GraphView = { html, mount, NODE_W, NODE_H };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.GraphView;
})(typeof window !== 'undefined' ? window : globalThis);
