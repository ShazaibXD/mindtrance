const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../js/core/graph.js');

const C = (id, level, prior, prereqs) => ({ id, level, prior, prereqs: prereqs || [] });
const track = () => ({
  target: 't',
  concepts: [
    C('a', 1, 0.9), C('b', 1, 0.5), C('c', 2, 0.7, [['a', 0.5, ''], ['b', 0.9, '']]),
    C('d', 1, 0.3), C('t', 3, 0.5, [['c', 0.9, ''], ['d', 0.6, '']]),
  ],
});

test('valid graph has no errors', () => assert.deepEqual(G.validate(track()), []));

test('detects duplicates, unknown prereqs, self loops, bad weights, bad priors', () => {
  const t = track();
  t.concepts.push(C('a', 1, 0.5));
  t.concepts.find((c) => c.id === 'c').prereqs.push(['zzz', 0.5, ''], ['c', 0.5, ''], ['a', 1.5, '']);
  t.concepts.find((c) => c.id === 'd').prior = 1;
  const errs = G.validate(t).join('|');
  for (const frag of ['duplicate concept id: a', 'unknown prerequisite zzz', 'depends on itself', 'weight must be', 'prior must be']) assert.ok(errs.includes(frag), frag);
});

test('detects cycles', () => {
  const t = track();
  t.concepts.find((c) => c.id === 'a').prereqs = [['t', 0.5, '']];
  assert.ok(G.validate(t).some((e) => e.startsWith('cycle')));
});

test('detects concepts that never lead to the target', () => {
  const t = track();
  t.concepts.push(C('orphan', 1, 0.5));
  assert.ok(G.validate(t).some((e) => e.includes('orphan')));
});

test('ancestors report depth and strongest chain', () => {
  const gr = G.build(track());
  const anc = G.ancestors(gr, 't');
  assert.deepEqual([...anc.keys()].sort(), ['a', 'b', 'c', 'd']);
  assert.equal(anc.get('c').depth, 1);
  assert.equal(anc.get('b').depth, 2);
  assert.ok(Math.abs(anc.get('b').pathWeight - 0.81) < 1e-9);
  assert.deepEqual([...G.descendants(gr, 'a')].sort(), ['c', 't']);
});

test('topological order puts prerequisites first', () => {
  const gr = G.build(track());
  const o = G.topoOrder(gr);
  assert.ok(o.indexOf('a') < o.indexOf('c') && o.indexOf('c') < o.indexOf('t'));
});

test('suspect ranking does not blindly blame the nearest parent', () => {
  const gr = G.build(track());
  // c is the nearest parent but strong; d is weaker and also a direct parent; b is deep and weak.
  const r = G.rankSuspects(gr, 't', { c: 0.95, d: 0.9, b: 0.1, a: 0.9 });
  assert.equal(r[0].id, 'b');
});

test('hints boost a suspect and mastery evidence changes the order', () => {
  const gr = G.build(track());
  const m = { a: 0.9, b: 0.9, c: 0.9, d: 0.9 };
  assert.equal(G.rankSuspects(gr, 't', m, { hints: { a: 0.5 } })[0].id, 'a');
  assert.equal(G.rankSuspects(gr, 't', { ...m, d: 0.05 })[0].id, 'd');
});

test('includeTarget adds the target as a candidate', () => {
  const gr = G.build(track());
  const r = G.rankSuspects(gr, 't', { t: 0.1, a: 0.99, b: 0.99, c: 0.99, d: 0.99 }, { includeTarget: true });
  assert.equal(r[0].id, 't');
});

test('blockedBy lists confirmed-gap ancestors only', () => {
  const gr = G.build(track());
  assert.deepEqual(G.blockedBy(gr, 't', (id) => id === 'b'), ['b']);
  assert.deepEqual(G.blockedBy(gr, 'a', () => true), []);
});

test('layout layers prerequisites above dependents with no overlaps', () => {
  const gr = G.build(track());
  const { pos, width, height } = G.layout(gr);
  assert.ok(pos.a.y < pos.c.y && pos.c.y < pos.t.y);
  const same = Object.values(pos).filter((p) => p.y === pos.a.y);
  const xs = same.map((p) => p.x).sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= 160);
  assert.ok(width > 0 && height > 0);
});
