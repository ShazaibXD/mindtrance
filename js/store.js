/* Persistence and student state: profiles, mastery, learning events, sessions.
 * Everything lives in localStorage under one key. This is local-only storage, not an account system. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const KEY = 'mindtrace.v1';
  const VERSION = 1;

  function memoryStorage() {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) };
  }

  function browserStorage() {
    try {
      const s = g.localStorage;
      const probe = '__mt_probe__';
      s.setItem(probe, '1');
      s.removeItem(probe);
      return s;
    } catch (e) {
      return null;
    }
  }

  const blankData = () => ({
    settings: { theme: 'dark', examFocus: '', showSolution: true, geminiKey: '', useGemini: false },
    mastery: {},
    events: [],
    sessions: {},
    customs: {},
    reviews: {},
    schema: 2,
    seq: 1,
  });

  function create(opts) {
    const o = opts || {};
    const now = o.now || (() => Date.now());
    const storage = o.storage || browserStorage() || memoryStorage();
    const persistent = !!(o.storage || browserStorage());
    const listeners = new Set();
    let root = load();

    function load() {
      try {
        const raw = storage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.v === VERSION && parsed.profiles) return parsed;
        }
      } catch (e) { /* corrupted storage: start fresh */ }
      return { v: VERSION, profiles: {}, active: null };
    }

    function save() {
      try { storage.setItem(KEY, JSON.stringify(root)); } catch (e) { /* quota or privacy mode */ }
    }
    function emit() { listeners.forEach((fn) => { try { fn(); } catch (e) { /* listener failure must not break state */ } }); }
    function commit() { save(); emit(); }

    const profile = () => (root.active ? root.profiles[root.active] || null : null);
    const data = () => {
      const p = profile();
      if (!p) throw new Error('No active profile');
      if (!p.data.customs) p.data.customs = {}; // saves from before custom questions existed
      if (!p.data.reviews) p.data.reviews = {};
      if ((p.data.schema || 1) < 2) migrateOutcomes(p.data); // saves from before the outcome taxonomy
      return p.data;
    };

    /* One-time rename of old outcome names in saved sessions and events. */
    function migrateOutcomes(d) {
      const fix = MT.diagnose.normalizeOutcome;
      for (const e of d.events || []) if (e.category) e.category = fix(e.category);
      for (const s of Object.values(d.sessions || {})) {
        if (s.diagnosis && s.diagnosis.category) s.diagnosis.category = fix(s.diagnosis.category);
        if (s.gap && s.gap.outcome) s.gap.outcome = fix(s.gap.outcome);
        for (const h of s.history || []) if (h.category) h.category = fix(h.category);
      }
      d.schema = 2;
    }

    /* Make the active profile's own questions available as tracks (and hide other profiles' ones). */
    function syncCustom() {
      if (!MT.custom || !MT.data) return;
      const p = profile();
      const entries = p && p.data.customs ? Object.values(p.data.customs) : [];
      MT.data.setCustom(entries.map((e) => MT.custom.buildTrack(e)));
    }

    /* ---------- profiles ---------- */
    function validateName(name) {
      const n = String(name || '').trim().replace(/\s+/g, ' ');
      if (n.length < 2) return { ok: false, error: 'Enter a name with at least 2 characters.' };
      if (n.length > 40) return { ok: false, error: 'Keep the name under 40 characters.' };
      return { ok: true, name: n };
    }

    function signUp(name, extra) {
      const v = validateName(name);
      if (!v.ok) return v;
      if (Object.values(root.profiles).some((p) => p.name.toLowerCase() === v.name.toLowerCase())) {
        return { ok: false, error: 'A local profile with that name already exists. Sign in instead.' };
      }
      const id = 'p' + now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
      root.profiles[id] = Object.assign({ id, name: v.name, createdAt: now(), demo: false, data: blankData() }, extra || {});
      root.active = id;
      syncCustom();
      commit();
      return { ok: true, id };
    }

    function signIn(id) {
      if (!root.profiles[id]) return { ok: false, error: 'That profile no longer exists.' };
      root.active = id;
      syncCustom();
      commit();
      return { ok: true };
    }

    function renameProfile(name) {
      const v = validateName(name);
      if (!v.ok) return v;
      const me = profile();
      if (Object.values(root.profiles).some((p) => p.id !== me.id && p.name.toLowerCase() === v.name.toLowerCase())) return { ok: false, error: 'Another local profile already uses that name.' };
      me.name = v.name;
      commit();
      return { ok: true };
    }
    function signOut() { root.active = null; syncCustom(); commit(); }
    function deleteProfile(id) {
      delete root.profiles[id];
      if (root.active === id) root.active = null;
      syncCustom();
      commit();
    }

    /* ---------- mastery ---------- */
    const mkey = (t, c) => t + ':' + c;
    function priorOf(trackId, conceptId) {
      const track = MT.data.track(trackId);
      const c = track && track.concepts.find((x) => x.id === conceptId);
      if (!c) throw new Error('Unknown concept ' + trackId + ':' + conceptId);
      return c.prior;
    }
    /* The stored record, with forgetting applied up to now (spec 11.1): the estimate drifts back toward the prior. */
    function record(trackId, conceptId) {
      const r = data().mastery[mkey(trackId, conceptId)];
      const prior = priorOf(trackId, conceptId);
      if (!r) return { p: prior, stored: prior, prior, obs: 0, fails: 0, learned: 0, updatedAt: null, lambda: 7, W: 0, lastVerifiedAt: null };
      const dt = r.updatedAt ? (now() - r.updatedAt) / 86400000 : 0;
      return Object.assign({ lambda: 7, W: 0, lastVerifiedAt: null }, r, { stored: r.p, prior, p: MT.bkt.decay(r.p, prior, dt, r.lambda || 7) });
    }
    const p = (trackId, conceptId) => record(trackId, conceptId).p;
    function masteryMap(trackId) {
      const out = {};
      for (const c of MT.data.track(trackId).concepts) out[c.id] = p(trackId, c.id);
      return out;
    }

    function addEvent(e) {
      const d = data();
      const ev = Object.assign({ id: 'e' + d.seq++, at: now() }, e);
      d.events.push(ev);
      if (d.events.length > 2000) d.events.splice(0, d.events.length - 2000);
      return ev;
    }

    /* An answer: updates the estimate with BKT observation only (no learning). */
    function observe(trackId, conceptId, correct, metaIn) {
      const { bkt: bktParams, ...meta } = metaIn || {};
      const rec = Object.assign({}, record(trackId, conceptId));
      delete rec.stored; delete rec.prior;
      const r = MT.bkt.observe(rec.p, correct, bktParams);
      rec.p = r.after;
      rec.obs += 1;
      if (!correct) rec.fails += 1;
      rec.updatedAt = now();
      data().mastery[mkey(trackId, conceptId)] = rec;
      const ev = addEvent(Object.assign({ type: 'OBSERVATION', trackId, conceptId, correct: !!correct, before: r.before, after: r.after }, meta));
      commit();
      return { before: r.before, after: r.after, event: ev };
    }

    /* A recovery intervention: the only place a learning transition is applied. */
    function learn(trackId, conceptId, metaIn) {
      const { bkt: bktParams, ...meta } = metaIn || {};
      const rec = Object.assign({}, record(trackId, conceptId));
      delete rec.stored; delete rec.prior;
      const before = rec.p;
      rec.p = MT.bkt.learn(before, bktParams);
      rec.learned += 1;
      rec.updatedAt = now();
      data().mastery[mkey(trackId, conceptId)] = rec;
      const ev = addEvent(Object.assign({ type: 'LEARNING', trackId, conceptId, before, after: rec.p }, meta));
      commit();
      return { before, after: rec.p, event: ev };
    }

    /* Evidence-based status. A starting assumption is never shown as mastery: that needs answers on record. */
    function conceptState(trackId, conceptId) {
      const rec = record(trackId, conceptId);
      let status;
      if (rec.obs === 0 && rec.learned === 0) status = 'NOT_ASSESSED';
      else {
        status = MT.bkt.status(rec.p);
        if (status === 'CONFIRMED_GAP' && rec.fails === 0) status = 'NEEDS_VERIFICATION';
        if (status === 'MASTERED' && !(rec.obs >= 2 || (rec.learned > 0 && rec.obs >= 1))) status = 'NEEDS_VERIFICATION'; // provisional needs at least two observations
      }
      return { p: rec.p, obs: rec.obs, fails: rec.fails, uncertainty: 1 / (1 + (rec.W || 0)), status };
    }
    const isGap = (trackId, conceptId) => conceptState(trackId, conceptId).status === 'CONFIRMED_GAP';

    /* Display state of every concept in a track: evidence status plus suspected, learning, ready and blocked overlays. */
    function graphState(trackId) {
      const track = MT.data.track(trackId);
      const gr = MT.graph.build(track);
      const out = {};
      const base = {};
      for (const c of track.concepts) { out[c.id] = conceptState(trackId, c.id); base[c.id] = out[c.id].status; }
      const suspected = new Set();
      const learning = new Set();
      const ready = new Set();
      for (const s of Object.values(data().sessions)) {
        if (s.trackId !== trackId || s.closed) continue;
        if ((s.state === 'ERROR_CLASSIFIED' || s.state === 'PROBE_REQUIRED') && s.diagnosis) {
          for (const c of s.diagnosis.candidates.slice(s.probeIndex || 0, (s.probeIndex || 0) + 1)) suspected.add(c.id);
        }
        if (s.gap && ['RECOVERY_REQUIRED', 'RECOVERY_IN_PROGRESS'].includes(s.state)) learning.add(s.gap.conceptId);
        if (s.gap && s.state === 'VERIFICATION_REQUIRED') ready.add(s.gap.conceptId);
      }
      for (const id of suspected) if (out[id] && !['CONFIRMED_GAP', 'MASTERED'].includes(out[id].status)) out[id].status = 'SUSPECTED_GAP';
      for (const id of learning) if (out[id] && out[id].status !== 'MASTERED') out[id].status = 'LEARNING_IN_PROGRESS';
      for (const id of ready) if (out[id] && out[id].status !== 'MASTERED') out[id].status = 'READY_FOR_REASSESSMENT';
      for (const c of track.concepts) {
        if (['MASTERED', 'CONFIRMED_GAP', 'LEARNING_IN_PROGRESS', 'READY_FOR_REASSESSMENT'].includes(out[c.id].status)) continue;
        const blockers = MT.graph.blockedBy(gr, c.id, (aid) => base[aid] === 'CONFIRMED_GAP');
        if (blockers.length) { out[c.id].status = 'BLOCKED'; out[c.id].blockedBy = blockers; }
      }
      return out;
    }

    /* Open-ended work: evidence-weighted rubric accumulator (spec 11.2). The estimate becomes the accumulated mean. */
    function rubric(trackId, conceptId, R, w, metaIn) {
      const meta = metaIn || {};
      const rec = Object.assign({}, record(trackId, conceptId));
      delete rec.stored; delete rec.prior;
      const before = rec.p;
      const u = MT.bkt.rubricUpdate(rec.W > 0 ? { M: rec.p, W: rec.W } : null, R, w);
      rec.p = u.M; rec.W = u.W; rec.obs += 1; if (R < 0.5) rec.lowScores = (rec.lowScores || 0) + 1; rec.updatedAt = now(); // a weak essay is softer evidence than a failed probe, so it does not count as a confirmed miss
      data().mastery[mkey(trackId, conceptId)] = rec;
      const ev = addEvent(Object.assign({ type: 'RUBRIC', trackId, conceptId, correct: R >= 0.5, score: R, weight: w, before, after: rec.p, uncertainty: u.U }, meta));
      commit();
      return { before, after: rec.p, uncertainty: u.U, event: ev };
    }

    /* A verified recovery or review: schedule the next spaced review and double the stability half-life on a spaced success. */
    function noteVerified(trackId, conceptId) {
      const d = data();
      const key = mkey(trackId, conceptId);
      const rec = Object.assign({}, record(trackId, conceptId));
      delete rec.stored; delete rec.prior;
      const spaced = rec.lastVerifiedAt && now() - rec.lastVerifiedAt >= 86400000;
      if (spaced) rec.lambda = Math.min(56, (rec.lambda || 7) * 2);
      rec.lastVerifiedAt = now();
      d.mastery[key] = rec;
      d.reviews[key] = { trackId, conceptId, reason: 'spaced', dueAt: now() + (rec.lambda || 7) * 86400000 };
      commit();
      return { lambda: rec.lambda, dueAt: d.reviews[key].dueAt };
    }

    /* ---------- sessions ---------- */
    function newSession(fields) {
      const d = data();
      const id = 's' + d.seq++;
      const session = Object.assign({
        id, state: 'READY', createdAt: now(), updatedAt: now(), log: [],
        attempt: null, diagnosis: null, probeIndex: 0, probes: [], gap: null, recovery: null, verification: null, result: null,
      }, fields);
      d.sessions[id] = session;
      commit();
      return session;
    }
    const getSession = (id) => (profile() ? data().sessions[id] || null : null);
    function touch(session) { session.updatedAt = now(); commit(); }
    function sessionList() {
      return profile() ? Object.values(data().sessions).sort((a, b) => b.updatedAt - a.updatedAt) : [];
    }
    function activeFor(trackId, problemId) {
      return sessionList().find((s) => s.trackId === trackId && s.problemId === problemId && !s.closed) || null;
    }
    function closeSession(id) { const s = getSession(id); if (s) { s.closed = true; touch(s); } }

    function updateSettings(patch) { Object.assign(data().settings, patch); commit(); }
    function resetProgress() {
      const p0 = profile();
      if (p0) { p0.data = blankData(); syncCustom(); commit(); }
    }

    /* ---------- spaced review ---------- */
    function scheduleReview(trackId, conceptId, reason, days) {
      const d = data();
      d.reviews[mkey(trackId, conceptId)] = { trackId, conceptId, reason, dueAt: now() + days * 86400000 };
      commit();
    }
    const dueReviews = () => Object.values(data().reviews).filter((r) => r.dueAt <= now() && MT.data.track(r.trackId)).sort((a, b) => a.dueAt - b.dueAt);
    function clearReview(trackId, conceptId) { delete data().reviews[mkey(trackId, conceptId)]; commit(); }

    /* ---------- custom questions ---------- */
    function addCustomTrack(entry) {
      const d = data();
      const id = MT.custom.makeId(entry.question);
      if (!d.customs[id]) {
        d.customs[id] = { id, spec: entry.spec, question: entry.question, source: entry.source || 'gemini', createdAt: now() };
        syncCustom();
        commit();
      }
      return id;
    }
    function removeCustomTrack(id) {
      const d = data();
      delete d.customs[id];
      for (const [sid, s] of Object.entries(d.sessions)) if (s.trackId === id) delete d.sessions[sid];
      for (const k of Object.keys(d.mastery)) if (k.startsWith(id + ':')) delete d.mastery[k];
      d.events = d.events.filter((e) => e.trackId !== id);
      syncCustom();
      commit();
    }
    function exportData() { const p0 = profile(); return p0 ? JSON.stringify({ exportedAt: now(), name: p0.name, data: Object.assign({}, p0.data, { settings: Object.assign({}, p0.data.settings, { geminiKey: '' }) }) }, null, 2) : '{}'; }

    syncCustom();

    return {
      persistent, now, rubric, noteVerified, isGap, scheduleReview, dueReviews, clearReview, addCustomTrack, removeCustomTrack, customTracks: () => (profile() ? Object.values(data().customs) : []),
      subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
      profiles: () => Object.values(root.profiles), profile, validateName, signUp, signIn, signOut, deleteProfile, renameProfile,
      data, p, record, masteryMap, observe, learn, conceptState, graphState, addEvent, commit,
      newSession, getSession, touch, sessionList, activeFor, closeSession,
      settings: () => Object.assign({}, blankData().settings, data().settings), updateSettings, resetProgress, exportData,
      events: () => data().events,
    };
  }

  MT.store = { create, KEY, VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.store;
})(typeof window !== 'undefined' ? window : globalThis);
