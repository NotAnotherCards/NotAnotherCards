import { test, expect, expectDashboardReady } from './fixtures.js';
import { registerAndOnboard } from './helpers.js';

test('register, onboard, and reach a working dashboard', async ({
  page,
  browser,
}, testInfo) => {
  const version = browser.version();
  console.log(`Google Chrome ${version} (${testInfo.project.name})`);
  testInfo.annotations.push({ type: 'browser-version', description: version });

  const { email } = await registerAndOnboard(page);
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  // A full navigation must recover the persisted session and local database too.
  await page.reload();
  await expectDashboardReady(page);
  await expect(page.getByText(email, { exact: true })).toBeVisible();
});
