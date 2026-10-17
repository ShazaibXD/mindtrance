/* Browser smoke test: loads index.html from file:// in headless Chrome. Skipped when Chrome is not installed. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CANDIDATES = [
  process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);
const chrome = CANDIDATES.find((p) => fs.existsSync(p));
const index = path.join(__dirname, '..', 'index.html');

function dump(hash) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-smoke-'));
  const r = spawnSync(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--user-data-dir=' + dir, '--virtual-time-budget=5000', '--dump-dom', 'file://' + index + hash], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  fs.rmSync(dir, { recursive: true, force: true });
  return r.stdout || '';
}

test('landing page renders from file:// with the graph and all six domains', { skip: !chrome && 'Chrome not found' }, () => {
  const dom = dump('');
  assert.match(dom, /Find the gap\./);
  assert.match(dom, /class="gv-node/);
  for (const d of ['JEE Physics', 'JEE Chemistry', 'JEE Mathematics', 'NEET Biology', 'GATE Computer Science', 'First-year Engineering']) assert.ok(dom.includes(d), d);
  assert.ok(!dom.includes('Something went wrong'));
});

test('protected routes redirect to sign in when there is no profile', { skip: !chrome && 'Chrome not found' }, () => {
  const dom = dump('#/app/dashboard');
  assert.match(dom, /<title>Sign in \| MINDTRACE<\/title>/);
  assert.match(dom, /Create a profile|Sign in/);
});

test('unknown routes show a not-found state instead of a blank page', { skip: !chrome && 'Chrome not found' }, () => {
  assert.match(dump('#/does-not-exist'), /Page not found/);
});
