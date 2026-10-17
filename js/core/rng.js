/* Small seeded random number generator so generated problems are reproducible. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});

  function create(seed) {
    let a = (seed >>> 0) || 1;
    const next = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next,
      int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
      pick: (arr) => arr[Math.floor(next() * arr.length)],
    };
  }

  /* Round to a number of significant figures and return a Number. */
  function sig(v, n) {
    return v === 0 ? 0 : Number(v.toPrecision(n || 3));
  }

  MT.rng = { create, sig };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.rng;
})(typeof window !== 'undefined' ? window : globalThis);
