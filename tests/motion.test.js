const test = require('node:test');
const assert = require('node:assert/strict');
require('./load.js');
require('../js/ui/util.js');
const motion = require('../js/ui/motion.js');

test('count-up formatting rounds integers and keeps requested decimals', () => {
  assert.equal(motion.formatCount(6.6), '7');
  assert.equal(motion.formatCount(0), '0');
  assert.equal(motion.formatCount(0.456, 2), '0.46');
  assert.equal(motion.formatCount(39, 0), '39');
});

test('motion is never enabled outside a browser, so server-side code and tests see a plain page', () => {
  assert.equal(motion.enabled(), false);
  assert.doesNotThrow(() => motion.enter({ querySelectorAll: () => [], querySelector: () => null }, { entering: true }));
  assert.doesNotThrow(() => motion.teardown());
});
