const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/core/expr.js');

test('parses plain numbers, units, scientific notation, fractions, percent', () => {
  assert.deepEqual(E.parseAnswer('2'), { ok: true, value: 2, unit: '', percent: false });
  const a = E.parseAnswer('2.4 kV');
  assert.equal(a.value, 2.4); assert.equal(a.unit, 'kV');
  assert.equal(E.parseAnswer('1.5e-3 A').value, 0.0015);
  assert.ok(Math.abs(E.parseAnswer('1.2 x 10^3').value - 1200) < 1e-9);
  assert.equal(E.parseAnswer('10^-8').value, 1e-8);
  assert.ok(Math.abs(E.parseAnswer('1/4').value - 0.25) < 1e-12);
  const p = E.parseAnswer('32%');
  assert.equal(p.percent, true); assert.ok(Math.abs(p.value - 0.32) < 1e-12);
  assert.equal(E.parseAnswer('−5').value, -5);
});

test('rejects garbage and oversized input', () => {
  for (const bad of ['', '   ', 'abc', 'process.exit()', '1/0', 'x'.repeat(200)]) assert.equal(E.parseAnswer(bad).ok, false, bad);
  assert.equal(E.parseAnswer(undefined).ok, false);
});

test('unit conversion and dimension mismatch', () => {
  assert.equal(E.valueIn(E.parseAnswer('2.4 kV'), 'V').value, 2400);
  assert.equal(E.valueIn(E.parseAnswer('500 mA'), 'A').value, 0.5);
  assert.equal(E.valueIn(E.parseAnswer('3'), 'A').assumedUnit, true);
  assert.equal(E.valueIn(E.parseAnswer('3 V'), 'A').ok, false);
  assert.equal(E.valueIn(E.parseAnswer('6 Ω'), 'ohm').value, 6);
});

test('tolerances', () => {
  assert.ok(E.close(2.01, 2, { tolPct: 1 }));
  assert.ok(!E.close(2.1, 2, { tolPct: 1 }));
  assert.ok(E.close(6.99, 6.98, { tolAbs: 0.02 }));
  assert.ok(!E.close(7.1, 6.98, { tolAbs: 0.02 }));
});

test('expression equivalence, including implicit multiplication', () => {
  assert.ok(E.exprEquivalent('6x cos(3x^2+1)', '6*x*cos(3*x^2+1)'));
  assert.ok(E.exprEquivalent('2x', 'x+x'));
  assert.ok(E.exprEquivalent('-2x sin(x^2)', '-2*x*sin(x**2)'));
  assert.ok(!E.exprEquivalent('cos(3x^2+1)', '6x cos(3x^2+1)'));
  assert.ok(E.exprEquivalent('x^2 + 2x + 1', '(x+1)^2'));
  assert.ok(E.exprEquivalent('sqrt(x)', 'x^0.5'));
  assert.ok(E.exprEquivalent('e^x', 'exp(x)'));
});

test('operator precedence', () => {
  const f = E.parseExpr('-x^2');
  assert.equal(f({ x: 3 }), -9);
  assert.equal(E.parseExpr('2^3^2')({ x: 0 }), 512);
  assert.equal(E.parseExpr('1/2x')({ x: 4 }), 2);
});

test('unsafe or malformed expressions are rejected, never evaluated', () => {
  for (const bad of ['', 'alert(1)', 'constructor', 'x;y', 'process', '(x', 'x)', 'sin x', '2 +', '__proto__', 'x'.repeat(300), '('.repeat(100) + 'x' + ')'.repeat(100)]) {
    assert.equal(E.exprParses(bad), false, bad.slice(0, 20));
  }
  assert.equal(E.exprEquivalent('1/0', '1/0'), false);
});
