import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.js';
import { registerAndOnboard, signIn } from './helpers.js';

async function createWordDeck(page: Page) {
  await page.getByRole('button', { name: 'My Library', exact: true }).click();
  await page.getByRole('button', { name: 'Create Deck', exact: true }).click();
  await page.getByLabel('Deck Title', { exact: true }).fill('Spanish words');
  await page
    .getByRole('button', {
      name: 'Words A word, its translation, and more',
      exact: true,
    })
    .click();
  await page.getByRole('button', { name: 'Save Deck', exact: true }).click();
  await page.getByTitle('Spanish words', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Add Card', exact: true })
    .first()
    .click();
}

test('word notes reject blank required fields and ignore whitespace in optional details', async ({
  page,
}) => {
  await registerAndOnboard(page);
  await createWordDeck(page);
  const word = page.getByLabel('Word in Spanish', { exact: true });
  const translation = page.getByLabel('Translation in English', {
    exact: true,
  });
  const save = page.getByRole('button', { name: 'Save', exact: true });
  await word.fill('   ');
  await translation.fill('   ');
  await save.click();
  await expect(word).toHaveAttribute('aria-invalid', 'true');
  await expect(translation).toHaveAttribute('aria-invalid', 'true');
  await word.fill('  hola  ');
  await translation.fill('  hello  ');
  await page.getByRole('button', { name: 'More details', exact: true }).click();
  for (const label of [
    'Part of speech',
    'Pronunciation',
    'Example',
    'Example translation',
    'Notes',
  ]) {
    await page.getByLabel(label, { exact: true }).fill('   ');
  }
  await save.click();
  await expect(save).not.toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'hola' })).toHaveCount(
    2,
  );
  await expect(page.getByTestId('sync-status')).toHaveText('Synced');
});

test('clearing a saved word detail persists in a fresh session', async ({
  page,
  newContext,
}) => {
  const account = await registerAndOnboard(page);
  await createWordDeck(page);
  await page.getByLabel('Word in Spanish', { exact: true }).fill('hola');
  await page
    .getByLabel('Translation in English', { exact: true })
    .fill('hello');
  await page.getByRole('button', { name: 'More details', exact: true }).click();
  await page.getByLabel('Notes', { exact: true }).fill('Remove this note');
  const created = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/sync/push' &&
      (response.request().postData()?.includes('Remove this note') ?? false),
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Save', exact: true }),
  ).not.toBeVisible();
  expect((await created).ok()).toBe(true);
  await page
    .getByRole('row')
    .filter({ hasText: 'hola' })
    .first()
    .getByRole('button', { name: 'Edit Card', exact: true })
    .click();
  await expect(page.getByLabel('Notes', { exact: true })).toHaveValue(
    'Remove this note',
  );
  await page.getByLabel('Notes', { exact: true }).fill('   ');
  // Wait for the changed note to reach the server before opening a fresh
  // session. The status badge can still say Synced during the debounce.
  const updated = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/sync/push' &&
      (response.request().postData()?.includes('hola') ?? false),
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Save', exact: true }),
  ).not.toBeVisible();
  expect((await updated).ok()).toBe(true);
  await expect(page.getByTestId('sync-status')).toHaveText('Synced');

  const fresh = await (await newContext()).newPage();
  await signIn(fresh, account);
  await fresh.getByRole('button', { name: 'My Library', exact: true }).click();
  await fresh.getByTitle('Spanish words', { exact: true }).click();
  await expect(fresh.getByRole('row').filter({ hasText: 'hola' })).toHaveCount(
    2,
  );
  await fresh
    .getByRole('row')
    .filter({ hasText: 'hola' })
    .first()
    .getByRole('button', { name: 'Edit Card', exact: true })
    .click();
  await expect(
    fresh.getByLabel('Word in Spanish', { exact: true }),
  ).toHaveValue('hola');
  await fresh
    .getByRole('button', { name: 'More details', exact: true })
    .click();
  await expect(fresh.getByLabel('Notes', { exact: true })).toHaveValue('');
});
