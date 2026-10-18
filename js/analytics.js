/* Pure analytics over the learning event log. Estimates, not measurements. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});

  const key = (e) => e.trackId + ':' + e.conceptId;

  /* Mean mastery estimate across every concept touched so far, after each estimate-changing event. */
  function masteryOverTime(events) {
    const cur = new Map();
    const out = [];
    for (const e of events) {
      if (e.type !== 'OBSERVATION' && e.type !== 'LEARNING' && e.type !== 'RUBRIC') continue;
      cur.set(key(e), e.after);
      let sum = 0;
      for (const v of cur.values()) sum += v;
      out.push({ at: e.at, mean: sum / cur.size, touched: cur.size, type: e.type });
    }
    return out;
  }

  function attemptSeries(events) {
    return events.filter((e) => e.type === 'ATTEMPT').map((e) => ({ at: e.at, category: e.category, correct: !!e.correct, trackId: e.trackId, conceptId: e.conceptId || null }));
  }

  /* Share of correct attempts over a sliding window. */
  function correctnessTrend(attempts, window) {
    const w = window || 5;
    return attempts.map((_, i) => {
      const slice = attempts.slice(Math.max(0, i - w + 1), i + 1);
      return { i, rate: slice.filter((a) => a.correct).length / slice.length, n: slice.length };
    });
  }

  function recoveryStats(events) {
    const started = events.filter((e) => e.type === 'RECOVERY_STARTED').length;
    const verified = events.filter((e) => e.type === 'MASTERY_VERIFIED').length;
    const failed = events.filter((e) => e.type === 'VERIFICATION_FAILED').length;
    return { started, verified, failed, rate: started ? verified / started : null };
  }

  /* Gap attempts grouped by the concept they implicated, most repeated first. */
  function repeatedMisconceptions(events) {
    const m = new Map();
    for (const e of events) {
      if (e.type !== 'ATTEMPT' || e.correct || !e.conceptId) continue;
      if (e.category !== 'PREREQUISITE_GAP' && e.category !== 'CONCEPTUAL_GAP' && e.category !== 'CALCULATION_OR_UNIT_ERROR') continue;
      const k = key(e) + ':' + e.category;
      const row = m.get(k) || { trackId: e.trackId, conceptId: e.conceptId, category: e.category, count: 0, last: 0 };
      row.count += 1;
      row.last = Math.max(row.last, e.at);
      m.set(k, row);
    }
    return [...m.values()].sort((a, b) => b.count - a.count || b.last - a.last);
  }

  /* Concepts with evidence, lowest estimate first. */
  function weakest(store, limit) {
    const rows = [];
    for (const t of MT.data.tracks) {
      for (const c of t.concepts) {
        const r = store.record(t.id, c.id);
        if (r.obs > 0) rows.push({ trackId: t.id, concept: c, p: r.p, obs: r.obs, fails: r.fails });
      }
    }
    return rows.sort((a, b) => a.p - b.p).slice(0, limit || 5);
  }

  function recentlyMastered(events, limit) {
    return events.filter((e) => e.type === 'MASTERY_VERIFIED').slice(-(limit || 5)).reverse();
  }

  MT.analytics = { masteryOverTime, attemptSeries, correctnessTrend, recoveryStats, repeatedMisconceptions, weakest, recentlyMastered };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.analytics;
})(typeof window !== 'undefined' ? window : globalThis);
