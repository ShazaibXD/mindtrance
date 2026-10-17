/* Shared UI helpers: escaping, math formatting, icons, status metadata. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});

  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* Lightweight math markup for authored content: V_1, x^2, 10^-8, 2^(32 - p). Input is escaped first. */
  function fmt(text) {
    return esc(text)
      .replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>')
      .replace(/\^\(([^)]*)\)/g, '<sup>$1</sup>')
      .replace(/\^(-?\d+|[A-Za-z])/g, '<sup>$1</sup>')
      .replace(/_\{([^}]+)\}/g, '<sub>$1</sub>')
      .replace(/_([A-Za-z0-9]{1,2})(?![A-Za-z0-9])/g, '<sub>$1</sub>');
  }

  const ICONS = {
    dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
    workspace: 'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z',
    map: 'M6 3a2 2 0 100 4 2 2 0 000-4zM18 3a2 2 0 100 4 2 2 0 000-4zM12 17a2 2 0 100 4 2 2 0 000-4zM6 7v2a3 3 0 003 3h6a3 3 0 003-3V7M12 12v5',
    progress: 'M3 3v18h18M7 15l4-5 3 3 5-7',
    explore: 'M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5zM4 19.5V21h16',
    settings: 'M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0M14 4v4M8 10v4M18 16v4',
    menu: 'M4 6h16M4 12h16M4 18h16',
    close: 'M6 6l12 12M18 6L6 18',
    check: 'M5 12.5l4.5 4.5L19 7',
    alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
    info: 'M12 16v-4M12 8h.01M22 12a10 10 0 11-20 0 10 10 0 0120 0z',
    lock: 'M7 11V7a5 5 0 0110 0v4M5 11h14v10H5z',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    refresh: 'M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
    sun: 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
    logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
    play: 'M6 4l14 8-14 8z',
    ask: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2zM12 8v4M12 15h.01',
  };
  const icon = (name, size) => '<svg aria-hidden="true" width="' + (size || 18) + '" height="' + (size || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="' + (ICONS[name] || '') + '"/></svg>';

  const STATUS = {
    MASTERED: { label: 'Mastered', short: 'Mastered', cls: 'mastered', glyph: '✓', help: 'Mastery estimate is 0.80 or higher.' },
    NEEDS_VERIFICATION: { label: 'Needs verification', short: 'Unverified', cls: 'verify', glyph: '~', help: 'Not enough evidence yet either way.' },
    SUSPECTED_GAP: { label: 'Suspected gap', short: 'Suspected', cls: 'suspect', glyph: '?', help: 'A diagnosis points here but no probe has confirmed it.' },
    CONFIRMED_GAP: { label: 'Confirmed gap', short: 'Confirmed gap', cls: 'gap', glyph: '!', help: 'A probe failed and the estimate is below 0.45.' },
    BLOCKED: { label: 'Blocked by prerequisite', short: 'Blocked', cls: 'blocked', glyph: '–', help: 'An upstream concept is a confirmed gap.' },
  };

  const CATEGORY_CLS = { CORRECT: 'mastered', CARELESS_SLIP: 'verify', UNIT_ERROR: 'verify', PREREQUISITE_GAP: 'gap', CONCEPT_MISCONCEPTION: 'gap' };

  const badge = (cls, text, dot) => '<span class="badge ' + cls + '">' + (dot ? '<span class="dot"></span>' : '') + esc(text) + '</span>';
  const statusBadge = (st) => badge(STATUS[st].cls, STATUS[st].label, true);
  const pct = (v) => Math.round(v * 100);
  const f2 = (v) => v.toFixed(2);
  function ago(ts, now) {
    const s = Math.max(0, Math.round(((now || Date.now()) - ts) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }
  const meter = (v, cls) => '<div class="meter ' + (cls || '') + '" role="img" aria-label="' + pct(v) + ' percent"><span style="width:' + Math.max(2, pct(v)) + '%"></span></div>';

  MT.ui = MT.ui || {};
  Object.assign(MT.ui, { esc, fmt, icon, ICONS, STATUS, CATEGORY_CLS, badge, statusBadge, pct, f2, ago, meter });
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.ui;
})(typeof window !== 'undefined' ? window : globalThis);
