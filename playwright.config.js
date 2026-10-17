const { defineConfig } = require('@playwright/test');

/* Uses the Chrome already installed on the machine (channel "chrome"), so no browser download is needed.
 * Set E2E_CHANNEL=chromium after `npx playwright install chromium` to use Playwright's own build instead. */
const channel = process.env.E2E_CHANNEL === 'chromium' ? undefined : 'chrome';

module.exports = defineConfig({
  testDir: 'tests/e2e',
  testMatch: '*.spec.js',
  timeout: 30000,
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4174', channel, headless: true, trace: 'retain-on-failure' },
  webServer: { command: 'node tests/e2e/serve.js 4174', url: 'http://127.0.0.1:4174', reuseExistingServer: true, timeout: 15000 },
});
