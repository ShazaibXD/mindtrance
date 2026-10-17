/* Safe parsing of numeric answers (with units) and algebraic expressions.
 * No eval, no Function constructor: a hand-written tokenizer and recursive-descent parser. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});

  /* ---------- units ---------- */
  const UNIT_TABLE = {};
  function addUnits(base, entries) {
    for (const [name, factor] of entries) UNIT_TABLE[name] = { base, factor };
  }
  addUnits('V', [['V', 1], ['kV', 1e3], ['mV', 1e-3]]);
  addUnits('A', [['A', 1], ['kA', 1e3], ['mA', 1e-3], ['uA', 1e-6]]);
  addUnits('ohm', [['ohm', 1], ['ohms', 1], ['kohm', 1e3], ['Mohm', 1e6], ['mohm', 1e-3]]);
  addUnits('W', [['W', 1], ['kW', 1e3], ['mW', 1e-3]]);
  addUnits('VA', [['VA', 1], ['kVA', 1e3]]);
  addUnits('m', [['m', 1], ['cm', 1e-2], ['mm', 1e-3], ['km', 1e3]]);
  addUnits('s', [['s', 1], ['ms', 1e-3]]);
  addUnits('kg', [['kg', 1], ['g', 1e-3]]);
  addUnits('N', [['N', 1], ['kN', 1e3]]);
  addUnits('m/s^2', [['m/s^2', 1], ['m/s2', 1], ['ms^-2', 1]]);
  addUnits('rad/s^2', [['rad/s^2', 1], ['rad/s2', 1]]);
  addUnits('mol/L', [['mol/L', 1], ['M', 1], ['mol/l', 1], ['mol/dm^3', 1]]);
  addUnits('Hz', [['Hz', 1], ['kHz', 1e3]]);
  addUnits('', [['', 1]]);

  function normUnit(u) {
    return String(u || '')
      .replace(/\s+/g, '')
      .replace(/[ΩΩ]/g, 'ohm')
      .replace(/[µμ]/g, 'u')
      .replace(/²/g, '^2')
      .replace(/[.,;]+$/, '');
  }

  function unitInfo(u) {
    const n = normUnit(u);
    if (Object.prototype.hasOwnProperty.call(UNIT_TABLE, n)) return Object.assign({ name: n, known: true }, UNIT_TABLE[n]);
    return { name: n, base: n, factor: 1, known: false };
  }

  /* ---------- numeric answers ---------- */
  const NUM = '(\\d+(?:\\.\\d+)?|\\.\\d+)';
  const SIGN = '[+\\-\\u2212]';
  const RE_SCI_TIMES = new RegExp('^(' + SIGN + ')?\\s*' + NUM + '\\s*(?:[x\\u00d7*])\\s*10\\s*\\^?\\s*\\(?\\s*(' + SIGN + '?\\d+)\\s*\\)?');
  const RE_POW10 = new RegExp('^(' + SIGN + ')?\\s*10\\s*\\^\\s*\\(?\\s*(' + SIGN + '?\\d+)\\s*\\)?');
  const RE_PLAIN = new RegExp('^(' + SIGN + ')?\\s*' + NUM + '(?:\\s*[eE]\\s*(' + SIGN + '?\\d+))?(?:\\s*\\/\\s*' + NUM + ')?');

  function toInt(s) { return parseInt(String(s).replace('−', '-'), 10); }

  function parseAnswer(raw) {
    if (typeof raw !== 'string') return { ok: false, reason: 'EMPTY' };
    const s = raw.trim();
    if (!s) return { ok: false, reason: 'EMPTY' };
    if (s.length > 80) return { ok: false, reason: 'TOO_LONG' };
    let m, value, rest;
    if ((m = RE_SCI_TIMES.exec(s))) {
      value = parseFloat(m[2]) * Math.pow(10, toInt(m[3]));
      if (m[1] && m[1] !== '+') value = -value;
      rest = s.slice(m[0].length);
    } else if ((m = RE_POW10.exec(s))) {
      value = Math.pow(10, toInt(m[2]));
      if (m[1] && m[1] !== '+') value = -value;
      rest = s.slice(m[0].length);
    } else if ((m = RE_PLAIN.exec(s))) {
      value = parseFloat(m[2]);
      if (m[3]) value *= Math.pow(10, toInt(m[3]));
      if (m[4]) {
        const d = parseFloat(m[4]);
        if (d === 0) return { ok: false, reason: 'DIV_ZERO' };
        value /= d;
      }
      if (m[1] && m[1] !== '+') value = -value;
      rest = s.slice(m[0].length);
    } else {
      return { ok: false, reason: 'NOT_A_NUMBER' };
    }
    if (!Number.isFinite(value)) return { ok: false, reason: 'NOT_FINITE' };
    let unit = rest.trim();
    let percent = false;
    if (unit === '%') { percent = true; value /= 100; unit = ''; }
    if (unit.length > 12) return { ok: false, reason: 'BAD_UNIT' };
    if (unit && !/^[A-Za-zµμΩΩ/^0-9².\-]+$/.test(unit)) return { ok: false, reason: 'BAD_UNIT' };
    return { ok: true, value, unit, percent };
  }

  /* Express a parsed answer in the units the problem expects.
   * Returns { ok, value } or { ok:false, reason:'DIMENSION' }. */
  function valueIn(parsed, answerUnit) {
    const target = unitInfo(answerUnit);
    if (!parsed.unit) return { ok: true, value: parsed.value, assumedUnit: true };
    const have = unitInfo(parsed.unit);
    if (have.base !== target.base) return { ok: false, reason: 'DIMENSION' };
    return { ok: true, value: (parsed.value * have.factor) / target.factor };
  }

  function close(a, b, spec) {
    const absTol = spec && spec.tolAbs != null ? spec.tolAbs : null;
    if (absTol != null) return Math.abs(a - b) <= absTol;
    const pct = spec && spec.tolPct != null ? spec.tolPct : 1;
    return Math.abs(a - b) <= Math.max((pct / 100) * Math.abs(b), 1e-12);
  }

  /* ---------- expressions ---------- */
  const FUNCS = { sin: Math.sin, cos: Math.cos, tan: Math.tan, ln: Math.log, log: Math.log10, exp: Math.exp, sqrt: Math.sqrt, abs: Math.abs };
  const CONSTS = { pi: Math.PI, e: Math.E };
  const NAMES = ['sqrt', 'sin', 'cos', 'tan', 'exp', 'log', 'abs', 'ln', 'pi', 'x', 'e'];
  const MAX_LEN = 200;

  function tokenize(src) {
    const s = src
      .replace(/²/g, '^2').replace(/³/g, '^3')
      .replace(/[×·]/g, '*').replace(/−/g, '-').replace(/√/g, 'sqrt')
      .replace(/\*\*/g, '^').replace(/\s+/g, '');
    const out = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/[0-9.]/.test(c)) {
        const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
        if (!m) throw new SyntaxError('bad number');
        out.push({ t: 'num', v: parseFloat(m[1]) });
        i += m[1].length;
      } else if (/[a-zA-Z]/.test(c)) {
        const rest = s.slice(i).toLowerCase();
        const name = NAMES.find((n) => rest.startsWith(n));
        if (!name) throw new SyntaxError('unknown name near "' + s.slice(i, i + 4) + '"');
        out.push({ t: 'name', v: name });
        i += name.length;
      } else if ('+-*/^()'.includes(c)) {
        out.push({ t: 'op', v: c });
        i++;
      } else {
        throw new SyntaxError('unexpected character "' + c + '"');
      }
    }
    return out;
  }

  function parseExpr(src) {
    if (typeof src !== 'string' || !src.trim()) throw new SyntaxError('empty expression');
    if (src.length > MAX_LEN) throw new SyntaxError('expression too long');
    const toks = tokenize(src);
    let pos = 0;
    const peek = () => toks[pos];
    const isOp = (v) => peek() && peek().t === 'op' && peek().v === v;
    const startsAtom = () => {
      const k = peek();
      if (!k) return false;
      return k.t === 'num' || k.t === 'name' || (k.t === 'op' && k.v === '(');
    };

    function expr(depth) {
      if (depth > 40) throw new SyntaxError('nested too deeply');
      let left = term(depth);
      while (isOp('+') || isOp('-')) {
        const op = toks[pos++].v;
        const right = term(depth);
        const l = left;
        left = op === '+' ? (v) => l(v) + right(v) : (v) => l(v) - right(v);
      }
      return left;
    }
    function term(depth) {
      let left = unary(depth);
      for (;;) {
        if (isOp('*') || isOp('/')) {
          const op = toks[pos++].v;
          const right = unary(depth);
          const l = left;
          left = op === '*' ? (v) => l(v) * right(v) : (v) => l(v) / right(v);
        } else if (startsAtom()) {
          const right = unary(depth);
          const l = left;
          left = (v) => l(v) * right(v);
        } else break;
      }
      return left;
    }
    function unary(depth) {
      if (isOp('-')) { pos++; const f = unary(depth); return (v) => -f(v); }
      if (isOp('+')) { pos++; return unary(depth); }
      return power(depth);
    }
    function power(depth) {
      const base = atom(depth);
      if (isOp('^')) {
        pos++;
        const ex = unary(depth);
        return (v) => Math.pow(base(v), ex(v));
      }
      return base;
    }
    function atom(depth) {
      const k = toks[pos++];
      if (!k) throw new SyntaxError('unexpected end');
      if (k.t === 'num') return () => k.v;
      if (k.t === 'op' && k.v === '(') {
        const f = expr(depth + 1);
        if (!isOp(')')) throw new SyntaxError('missing )');
        pos++;
        return f;
      }
      if (k.t === 'name') {
        if (k.v === 'x') return (v) => v.x;
        if (Object.prototype.hasOwnProperty.call(CONSTS, k.v)) { const c = CONSTS[k.v]; return () => c; }
        const fn = FUNCS[k.v];
        if (!isOp('(')) throw new SyntaxError(k.v + ' needs parentheses');
        pos++;
        const arg = expr(depth + 1);
        if (!isOp(')')) throw new SyntaxError('missing )');
        pos++;
        return (v) => fn(arg(v));
      }
      throw new SyntaxError('unexpected "' + k.v + '"');
    }

    const f = expr(0);
    if (pos < toks.length) throw new SyntaxError('unexpected "' + toks[pos].v + '"');
    return f;
  }

  const SAMPLES = [0.31, 0.73, 1.17, 1.62, 2.09, 2.47];

  function exprEquivalent(a, b) {
    let fa, fb;
    try { fa = parseExpr(a); fb = parseExpr(b); } catch (e) { return false; }
    let valid = 0;
    for (const x of SAMPLES) {
      const va = fa({ x });
      const vb = fb({ x });
      if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
      valid++;
      if (Math.abs(va - vb) > 1e-6 * Math.max(1, Math.abs(vb))) return false;
    }
    return valid >= 3;
  }

  function exprParses(src) {
    try { parseExpr(src); return true; } catch (e) { return false; }
  }

  MT.expr = { parseAnswer, valueIn, close, unitInfo, parseExpr, exprEquivalent, exprParses };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.expr;
})(typeof window !== 'undefined' ? window : globalThis);
