/* Prerequisite knowledge graph: validation, traversal, suspect ranking, layout.
 * Track shape: { concepts:[{id, level, prior, prereqs:[[id, weight, why]]}], target } */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});

  function build(track) {
    const byId = new Map();
    const parents = new Map();
    const children = new Map();
    for (const c of track.concepts) {
      byId.set(c.id, c);
      parents.set(c.id, []);
      children.set(c.id, []);
    }
    for (const c of track.concepts) {
      for (const [pid, weight, why] of c.prereqs || []) {
        if (!byId.has(pid)) continue; // reported by validate
        parents.get(c.id).push({ id: pid, weight, why: why || '' });
        children.get(pid).push({ id: c.id, weight, why: why || '' });
      }
    }
    return { track, byId, parents, children };
  }

  function findCycle(gr) {
    const state = new Map();
    let cycle = null;
    const stack = [];
    function visit(id) {
      state.set(id, 1);
      stack.push(id);
      for (const p of gr.parents.get(id)) {
        if (cycle) return;
        if (state.get(p.id) === 1) { cycle = stack.slice(stack.indexOf(p.id)).concat(p.id); return; }
        if (!state.get(p.id)) visit(p.id);
      }
      stack.pop();
      state.set(id, 2);
    }
    for (const id of gr.byId.keys()) if (!state.get(id) && !cycle) visit(id);
    return cycle;
  }

  /* Returns a list of human-readable problems. Empty list means valid. */
  function validate(track) {
    const errs = [];
    const seen = new Set();
    for (const c of track.concepts || []) {
      if (!c.id || typeof c.id !== 'string') { errs.push('concept without id'); continue; }
      if (seen.has(c.id)) errs.push('duplicate concept id: ' + c.id);
      seen.add(c.id);
      if (!(c.prior > 0 && c.prior < 1)) errs.push(c.id + ': prior must be in (0,1)');
      if (!Number.isInteger(c.level) || c.level < 1 || c.level > 3) errs.push(c.id + ': level must be 1, 2 or 3');
    }
    for (const c of track.concepts || []) {
      for (const e of c.prereqs || []) {
        const [pid, w] = e;
        if (!seen.has(pid)) errs.push(c.id + ': unknown prerequisite ' + pid);
        if (pid === c.id) errs.push(c.id + ': depends on itself');
        if (!(w > 0 && w <= 1)) errs.push(c.id + ' <- ' + pid + ': weight must be in (0,1]');
      }
    }
    if (!seen.has(track.target)) errs.push('target concept missing: ' + track.target);
    if (errs.length) return errs;
    const gr = build(track);
    const cyc = findCycle(gr);
    if (cyc) errs.push('cycle: ' + cyc.join(' -> '));
    if (!errs.length) {
      const reach = new Set([track.target, ...ancestors(gr, track.target).keys()]);
      for (const id of seen) if (!reach.has(id)) errs.push(id + ': does not lead to the target concept');
    }
    return errs;
  }

  /* All upstream concepts: Map id -> { depth (fewest hops), pathWeight (strongest chain product) } */
  function ancestors(gr, id) {
    const out = new Map();
    function walk(cur, depth, w) {
      for (const p of gr.parents.get(cur) || []) {
        const nw = w * p.weight;
        const prev = out.get(p.id);
        const nd = depth + 1;
        if (!prev || nd < prev.depth || nw > prev.pathWeight) {
          out.set(p.id, { depth: prev ? Math.min(prev.depth, nd) : nd, pathWeight: prev ? Math.max(prev.pathWeight, nw) : nw });
          walk(p.id, nd, nw);
        }
      }
    }
    walk(id, 0, 1);
    return out;
  }

  function descendants(gr, id) {
    const out = new Set();
    (function walk(cur) {
      for (const c of gr.children.get(cur) || []) if (!out.has(c.id)) { out.add(c.id); walk(c.id); }
    })(id);
    return out;
  }

  function topoOrder(gr) {
    const indeg = new Map();
    for (const id of gr.byId.keys()) indeg.set(id, gr.parents.get(id).length);
    const q = [...indeg].filter(([, d]) => d === 0).map(([id]) => id);
    const out = [];
    while (q.length) {
      const id = q.shift();
      out.push(id);
      for (const c of gr.children.get(id)) {
        indeg.set(c.id, indeg.get(c.id) - 1);
        if (indeg.get(c.id) === 0) q.push(c.id);
      }
    }
    return out;
  }

  /* Rank upstream causes of an error on `targetId`.
   * score = strongest dependency chain * (1 - mastery) * 0.9^(depth-1) + hint boost.
   * The nearest parent is not favoured by itself: a weaker, deeper concept can outrank it. */
  function rankSuspects(gr, targetId, mastery, opts) {
    const o = opts || {};
    const hints = o.hints || {};
    const rows = [];
    for (const [id, info] of ancestors(gr, targetId)) {
      const p = mastery[id] != null ? mastery[id] : gr.byId.get(id).prior;
      const decay = Math.pow(0.9, info.depth - 1);
      const base = info.pathWeight * (1 - p) * decay;
      const hint = hints[id] || 0;
      rows.push({ id, score: base + hint, parts: { pathWeight: info.pathWeight, mastery: p, depth: info.depth, decay, hint } });
    }
    if (o.includeTarget) {
      const p = mastery[targetId] != null ? mastery[targetId] : gr.byId.get(targetId).prior;
      const hint = hints[targetId] || 0;
      rows.push({ id: targetId, score: (1 - p) * 0.6 + hint, parts: { pathWeight: 1, mastery: p, depth: 0, decay: 1, hint } });
    }
    return rows.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  }

  /* True when a concept has a confirmed-gap ancestor. */
  function blockedBy(gr, id, isGap) {
    const out = [];
    for (const aid of ancestors(gr, id).keys()) if (isGap(aid)) out.push(aid);
    return out;
  }

  /* Layered layout: layer = longest path from a source concept. */
  function layout(gr, opts) {
    const o = Object.assign({ colGap: 190, rowGap: 120, nodeW: 160, nodeH: 56, pad: 40 }, opts || {});
    const layer = new Map();
    for (const id of topoOrder(gr)) {
      let l = 0;
      for (const p of gr.parents.get(id)) l = Math.max(l, layer.get(p.id) + 1);
      layer.set(id, l);
    }
    const layers = [];
    for (const [id, l] of layer) (layers[l] = layers[l] || []).push(id);
    const order = new Map();
    layers.forEach((ids, l) => {
      if (l > 0) {
        const bary = (id) => {
          const ps = gr.parents.get(id);
          return ps.length ? ps.reduce((s, p) => s + order.get(p.id), 0) / ps.length : 0;
        };
        ids.sort((a, b) => bary(a) - bary(b) || a.localeCompare(b));
      } else ids.sort();
      ids.forEach((id, i) => order.set(id, i));
    });
    const maxCols = Math.max(...layers.map((l) => l.length));
    const width = o.pad * 2 + (maxCols - 1) * o.colGap + o.nodeW;
    const pos = {};
    layers.forEach((ids, l) => {
      const span = (ids.length - 1) * o.colGap;
      const x0 = (width - o.nodeW) / 2 - span / 2;
      ids.forEach((id, i) => { pos[id] = { x: x0 + i * o.colGap, y: o.pad + l * o.rowGap, w: o.nodeW, h: o.nodeH }; });
    });
    return { pos, width, height: o.pad * 2 + (layers.length - 1) * o.rowGap + o.nodeH };
  }

  MT.graph = { build, validate, findCycle, ancestors, descendants, topoOrder, rankSuspects, blockedBy, layout };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.graph;
})(typeof window !== 'undefined' ? window : globalThis);
