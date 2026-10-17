const test = require('node:test');
const assert = require('node:assert/strict');
require('./load.js');
require('../js/ui/util.js');
require('../js/ui/graphview.js');
const MT = globalThis.MT;

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

test('renders every concept as an accessible, focusable node with status text', () => {
  const store = MT.store.create({ storage: mem() }); store.signUp('Tess');
  const track = MT.data.track('eee-transformers');
  store.observe(track.id, 'turns_ratio', false, {});
  const out = MT.GraphView.html(track, store.graphState(track.id), { selected: 'turns_ratio' });
  for (const c of track.concepts) assert.ok(out.includes('data-id="' + c.id + '"'), c.id);
  assert.equal((out.match(/class="gv-node/g) || []).length, track.concepts.length);
  assert.match(out, /aria-label="Turns, voltage and current ratios, Confirmed gap/);
  assert.match(out, /Blocked by prerequisite/);
  assert.match(out, /tabindex="0" role="button"/);
  const edges = track.concepts.reduce((n, c) => n + c.prereqs.length, 0);
  assert.equal((out.match(/class="gv-edge/g) || []).length, edges);
});

test('selection highlights upstream and downstream edges and dims unrelated nodes', () => {
  const store = MT.store.create({ storage: mem() }); store.signUp('Tess');
  const track = MT.data.track('eee-transformers');
  const out = MT.GraphView.html(track, store.graphState(track.id), { selected: 'turns_ratio' });
  assert.match(out, /hl-up/);
  assert.match(out, /hl-down/);
  // unit_conv is neither upstream nor downstream of turns_ratio
  assert.match(out, /gv-node st-\w+ dim[^"]*" data-id="unit_conv"/);
});

test('a broken dependency path is marked on edges', () => {
  const store = MT.store.create({ storage: mem() }); store.signUp('Tess');
  const track = MT.data.track('eee-transformers');
  store.observe(track.id, 'turns_ratio', false, {});
  assert.match(MT.GraphView.html(track, store.graphState(track.id), {}), /gv-edge broken/);
});

test('compact graphs have no controls and are not tab stops', () => {
  const store = MT.store.create({ storage: mem() }); store.signUp('Tess');
  const track = MT.data.track('jee-pulley');
  const out = MT.GraphView.html(track, store.graphState(track.id), { compact: true, key: 'x' });
  assert.ok(!out.includes('gv-controls'));
  assert.ok(out.includes('tabindex="-1"'));
});

test('markup is escaped for every track', () => {
  const store = MT.store.create({ storage: mem() }); store.signUp('Tess');
  for (const track of MT.data.tracks) {
    const out = MT.GraphView.html(track, store.graphState(track.id), {});
    assert.ok(!/<script/i.test(out));
    assert.ok(out.length > 500);
  }
});
