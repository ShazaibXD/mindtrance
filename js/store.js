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
    settings: { theme: 'dark', examFocus: '', showHints: true, geminiKey: '', useGemini: false },
    mastery: {},
    events: [],
    sessions: {},
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
      return p.data;
    };

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
      commit();
      return { ok: true, id };
    }

    function signIn(id) {
      if (!root.profiles[id]) return { ok: false, error: 'That profile no longer exists.' };
      root.active = id;
      commit();
      return { ok: true };
    }

    function signOut() { root.active = null; commit(); }
    function deleteProfile(id) {
      delete root.profiles[id];
      if (root.active === id) root.active = null;
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
    function record(trackId, conceptId) {
      const r = data().mastery[mkey(trackId, conceptId)];
      return r || { p: priorOf(trackId, conceptId), obs: 0, fails: 0, learned: 0, updatedAt: null };
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
    function observe(trackId, conceptId, correct, meta) {
      const rec = Object.assign({}, record(trackId, conceptId));
      const r = MT.bkt.observe(rec.p, correct);
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
    function learn(trackId, conceptId, meta) {
      const rec = Object.assign({}, record(trackId, conceptId));
      const before = rec.p;
      rec.p = MT.bkt.learn(before);
      rec.learned += 1;
      rec.updatedAt = now();
      data().mastery[mkey(trackId, conceptId)] = rec;
      const ev = addEvent(Object.assign({ type: 'LEARNING', trackId, conceptId, before, after: rec.p }, meta));
      commit();
      return { before, after: rec.p, event: ev };
    }

    function conceptState(trackId, conceptId) {
      const rec = record(trackId, conceptId);
      const base = MT.bkt.status(rec.p);
      let status = base;
      if (base === 'CONFIRMED_GAP' && rec.fails === 0) status = 'NEEDS_VERIFICATION'; // low prior alone is not evidence
      return { p: rec.p, obs: rec.obs, fails: rec.fails, status };
    }

    /* Display state of every concept in a track, including suspected and blocked. */
    function graphState(trackId) {
      const track = MT.data.track(trackId);
      const gr = MT.graph.build(track);
      const out = {};
      for (const c of track.concepts) out[c.id] = conceptState(trackId, c.id);
      const suspected = new Set();
      for (const s of Object.values(data().sessions)) {
        if (s.trackId !== trackId) continue;
        if ((s.state === 'ERROR_CLASSIFIED' || s.state === 'PROBE_REQUIRED') && s.diagnosis) {
          for (const c of s.diagnosis.candidates.slice(s.probeIndex || 0, (s.probeIndex || 0) + 1)) suspected.add(c.id);
        }
      }
      for (const id of suspected) if (out[id] && out[id].status !== 'CONFIRMED_GAP' && out[id].status !== 'MASTERED') out[id].status = 'SUSPECTED_GAP';
      for (const c of track.concepts) {
        if (out[c.id].status === 'MASTERED' || out[c.id].status === 'CONFIRMED_GAP') continue;
        const blockers = MT.graph.blockedBy(gr, c.id, (aid) => out[aid].status === 'CONFIRMED_GAP');
        if (blockers.length) { out[c.id].status = 'BLOCKED'; out[c.id].blockedBy = blockers; }
      }
      return out;
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
      if (p0) { p0.data = blankData(); commit(); }
    }
    function exportData() { const p0 = profile(); return p0 ? JSON.stringify({ exportedAt: now(), name: p0.name, data: Object.assign({}, p0.data, { settings: Object.assign({}, p0.data.settings, { geminiKey: '' }) }) }, null, 2) : '{}'; }

    return {
      persistent, now,
      subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
      profiles: () => Object.values(root.profiles), profile, validateName, signUp, signIn, signOut, deleteProfile,
      data, p, record, masteryMap, observe, learn, conceptState, graphState, addEvent, commit,
      newSession, getSession, touch, sessionList, activeFor, closeSession,
      settings: () => data().settings, updateSettings, resetProgress, exportData,
      events: () => data().events,
    };
  }

  MT.store = { create, KEY, VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.store;
})(typeof window !== 'undefined' ? window : globalThis);
