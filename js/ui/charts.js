/* Small dependency-free SVG charts with text alternatives. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const ui = MT.ui;
  const { esc } = ui;

  /* points: [{ x, y }] with y in [0,1]. thresholds: [{ y, label, cls }]. */
  function line(points, o) {
    const w = 600; const h = 220; const L = 38; const R = 70; const T = 12; const B = 28;
    const iw = w - L - R; const ih = h - T - B;
    const n = points.length;
    const X = (i) => L + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
    const Y = (v) => T + (1 - v) * ih;
    let s = '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(o.label) + '"><title>' + esc(o.label) + '</title>';
    for (const t of [0, 0.25, 0.5, 0.75, 1]) s += '<line x1="' + L + '" x2="' + (w - R) + '" y1="' + Y(t) + '" y2="' + Y(t) + '" class="grid"/><text x="' + (L - 6) + '" y="' + (Y(t) + 4) + '" text-anchor="end" class="tick">' + t.toFixed(2) + '</text>';
    for (const th of o.thresholds || []) s += '<line x1="' + L + '" x2="' + (w - R) + '" y1="' + Y(th.y) + '" y2="' + Y(th.y) + '" class="thr ' + (th.cls || '') + '"/><text x="' + (w - R + 6) + '" y="' + (Y(th.y) + 4) + '" class="tick ' + (th.cls || '') + '">' + esc(th.label) + '</text>';
    if (n > 1) s += '<path class="series" d="' + points.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join('') + '"/>';
    points.forEach((p, i) => { s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="' + (n > 40 ? 2 : 3.5) + '" class="pt"/>'; });
    s += '<text x="' + (L + iw / 2) + '" y="' + (h - 4) + '" text-anchor="middle" class="tick">' + esc(o.xLabel || '') + '</text></svg>';
    return s;
  }

  const GLYPH = { CORRECT_UNDERSTANDING: ['✓', 'mastered', 'Correct'], POSSIBLE_CARELESS_SLIP: ['S', 'verify', 'Careless slip'], CALCULATION_OR_UNIT_ERROR: ['U', 'verify', 'Unit error'], PREREQUISITE_GAP: ['G', 'gap', 'Prerequisite gap'], CONCEPTUAL_GAP: ['M', 'gap', 'Misconception'] };

  function attemptStrip(attempts) {
    return '<ol class="strip list-reset" aria-label="Attempts in order">' + attempts.map((a, i) => {
      const gl = GLYPH[a.category] || ['?', '', a.category];
      return '<li class="cell ' + gl[1] + '" title="Attempt ' + (i + 1) + ': ' + esc(gl[2]) + '"><span aria-hidden="true">' + gl[0] + '</span><span class="sr-only">Attempt ' + (i + 1) + ': ' + esc(gl[2]) + '</span></li>';
    }).join('') + '</ol><p class="hint">&#10003; correct &middot; S slip &middot; U unit error &middot; G gap &middot; M misconception</p>';
  }

  MT.charts = { line, attemptStrip };
  ui.charts = MT.charts;
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.charts;
})(typeof window !== 'undefined' ? window : globalThis);
