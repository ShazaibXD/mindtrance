const test = require('node:test');
const assert = require('node:assert/strict');
require('./load.js');
require('../js/ui/util.js');
const U = globalThis.MT.ui;

test('esc neutralises markup', () => {
  assert.equal(U.esc('<img src=x onerror="a()">&\''), '&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;');
  assert.equal(U.esc(null), '');
});

test('fmt renders sub and superscripts and stays escaped', () => {
  assert.equal(U.fmt('V_1/V_2 = N_1/N_2'), 'V<sub>1</sub>/V<sub>2</sub> = N<sub>1</sub>/N<sub>2</sub>');
  assert.equal(U.fmt('10^-8 M and m/s^2 and x^2'), '10<sup>-8</sup> M and m/s<sup>2</sup> and x<sup>2</sup>');
  assert.equal(U.fmt('2^(32 - p)'), '2<sup>32 - p</sup>');
  assert.equal(U.fmt('R_L = 12'), 'R<sub>L</sub> = 12');
  assert.ok(!U.fmt('<script>x^2</script>').includes('<script>'));
});

test('every status has a label and class', () => {
  for (const k of ['MASTERED', 'NEEDS_VERIFICATION', 'SUSPECTED_GAP', 'CONFIRMED_GAP', 'BLOCKED']) assert.ok(U.STATUS[k].label && U.STATUS[k].cls);
});
