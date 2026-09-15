import type { Page } from '@playwright/test';
import { test, expect, expectDashboardReady } from './fixtures.js';
import { registerAndOnboard, signIn } from './helpers.js';

async function createSyncedDeck(page: Page, title: string) {
  await page.getByRole('button', { name: 'My Library', exact: true }).click();
  await page.getByRole('button', { name: 'Create Deck', exact: true }).click();
  await page.getByLabel('Deck Title', { exact: true }).fill(title);
  const pushed = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/sync/push' &&
      (response.request().postData()?.includes(title) ?? false),
  );
  await page.getByRole('button', { name: 'Save Deck', exact: true }).click();
  expect((await pushed).ok()).toBe(true);
  await expect(page.getByTitle(title, { exact: true })).toBeVisible();
  await expect(page.getByTestId('sync-status')).toHaveText('Synced');
}

async function reloadAndPull(page: Page) {
  // Reload is a real user action that starts sync; sessions share no storage.
  const pulled = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/sync/pull',
  );
  await page.reload();
  const response = await pulled;
  expect(response.ok()).toBe(true);
  await response.finished();
  await expectDashboardReady(page);
  await page.getByRole('button', { name: 'My Library', exact: true }).click();
}

test('syncs between separate sessions and isolates accounts, including after switching', async ({
  page,
  newContext,
}) => {
  test.setTimeout(60_000);

  const accountA = await registerAndOnboard(page);
  const secondSession = await (await newContext()).newPage();
  await signIn(secondSession, accountA);
  await expectDashboardReady(secondSession);

  const deckA = `Private deck ${accountA.username}`;
  await createSyncedDeck(page, deckA);
  await reloadAndPull(secondSession);
  await expect(secondSession.getByTitle(deckA, { exact: true })).toBeVisible();

  const otherAccount = await (await newContext()).newPage();
  const accountB = await registerAndOnboard(otherAccount);
  const deckB = `Private deck ${accountB.username}`;
  await createSyncedDeck(otherAccount, deckB);
  await reloadAndPull(otherAccount);
  // Own data and a completed server pull make absence meaningful.
  await expect(otherAccount.getByTitle(deckB, { exact: true })).toBeVisible();
  await expect(otherAccount.getByTitle(deckA, { exact: true })).toHaveCount(0);

  await reloadAndPull(secondSession);
  await expect(secondSession.getByTitle(deckA, { exact: true })).toBeVisible();
  await expect(secondSession.getByTitle(deckB, { exact: true })).toHaveCount(0);

  // Reuse A's browser storage to exercise account-local database switching.
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL('/login');
  await signIn(page, accountB);
  await expectDashboardReady(page);
  await page.getByRole('button', { name: 'My Library', exact: true }).click();
  await expect(page.getByTitle(deckB, { exact: true })).toBeVisible();
  await expect(page.getByTitle(deckA, { exact: true })).toHaveCount(0);
});
