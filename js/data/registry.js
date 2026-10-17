/* Registry of examination domains and knowledge tracks.
 * Adding a subject means adding a track file that calls MT.data.register(track). */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});

  const domains = [
    { id: 'jee-physics', name: 'JEE Physics', exam: 'JEE', blurb: 'Mechanics, electricity and modern physics for JEE Main and Advanced.' },
    { id: 'jee-chemistry', name: 'JEE Chemistry', exam: 'JEE', blurb: 'Physical, organic and inorganic chemistry.' },
    { id: 'jee-maths', name: 'JEE Mathematics', exam: 'JEE', blurb: 'Calculus, algebra and coordinate geometry.' },
    { id: 'neet-biology', name: 'NEET Biology', exam: 'NEET', blurb: 'Genetics, physiology and ecology for NEET UG.' },
    { id: 'gate-cs', name: 'GATE Computer Science', exam: 'GATE', blurb: 'Networks, algorithms, systems and theory.' },
    { id: 'engineering', name: 'First-year Engineering', exam: 'B.Tech', blurb: 'Foundation subjects such as basic electrical engineering.' },
  ];
  const tracks = [];

  function register(track) {
    if (tracks.some((t) => t.id === track.id)) throw new Error('duplicate track id: ' + track.id);
    if (!domains.some((d) => d.id === track.domainId)) throw new Error('unknown domain: ' + track.domainId);
    tracks.push(track);
  }

  const data = {
    domains,
    tracks,
    register,
    track: (id) => tracks.find((t) => t.id === id) || null,
    tracksFor: (domainId) => tracks.filter((t) => t.domainId === domainId),
    problem(trackId, problemId) {
      const t = data.track(trackId);
      return t ? t.problems.find((p) => p.id === problemId) || null : null;
    },
    /* Instantiate a problem or verification template with a seed. */
    instantiate(def, seed) {
      const p = Object.assign({ id: def.id, title: def.title, seed }, def.gen(MT.rng.create(seed)));
      // A wrong-answer signature that coincides with the correct answer would misgrade a right answer.
      p.patterns = (p.patterns || []).filter((pat) => (p.answer.kind === 'expr'
        ? !MT.expr.exprEquivalent(pat.expr, p.answer.expr)
        : !MT.expr.close(pat.value, p.answer.value, p.answer)));
      return p;
    },
  };

  MT.data = data;
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
})(typeof window !== 'undefined' ? window : globalThis);
