/* Loads the browser scripts into Node in the same order as index.html. */
const path = require('node:path');
const root = path.join(__dirname, '..');
const files = [
  'js/core/bkt.js', 'js/core/rng.js', 'js/core/expr.js', 'js/core/graph.js', 'js/core/diagnose.js', 'js/core/machine.js', 'js/core/ai.js', 'js/custom.js',
  'js/data/registry.js', 'js/store.js', 'js/flow.js', 'js/analytics.js',
  'js/data/eee-transformers.js', 'js/data/jee-pulley.js', 'js/data/jee-ph.js', 'js/data/jee-chain-rule.js', 'js/data/neet-hardy-weinberg.js', 'js/data/gate-subnet.js', 'js/data/cse-twos-complement.js',
];
for (const f of files) require(path.join(root, f));
module.exports = globalThis.MT;
