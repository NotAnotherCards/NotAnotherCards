import { randomUUID } from 'node:crypto';
import { test, expect, expectDashboardReady } from './fixtures.js';
import { registerAndOnboard } from './helpers.js';

test('registration and onboarding explain invalid input and accept corrections', async ({
  page,
}) => {
  await page.goto('/register');
  const submit = page.getByRole('button', { name: 'Sign up', exact: true });
  await submit.click();
  for (const message of [
    'Name must be at least 2 characters',
    'Please enter a valid email address',
    'Password must be at least 8 characters',
    'Please confirm your password',
  ]) {
    await expect(
      page.getByRole('alert').filter({ hasText: message }),
    ).toBeVisible();
  }

  const email = page.getByLabel('Email', { exact: true });
  await email.fill('invalid-email');
  await submit.click();
  // The native email control blocks submission before the schema runs.
  await expect(email).toBeFocused();
  expect(
    await email.evaluate(
      (input: HTMLInputElement) => input.validity.typeMismatch,
    ),
  ).toBe(true);
  expect(
    await email.evaluate((input: HTMLInputElement) => input.validationMessage),
  ).not.toBe('');
  await expect(page).toHaveURL('/register');

  const id = randomUUID().replaceAll('-', '');
  await page.getByLabel('Name', { exact: true }).fill('Validation Test');
  await email.fill(`validation-${id}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('short');
  await page.getByLabel('Confirm Password', { exact: true }).fill('short');
  await submit.click();
  await expect(
    page.getByText('Password must be at least 8 characters', { exact: true }),
  ).toBeVisible();

  await page.getByLabel('Password', { exact: true }).fill('Browser-test-252!');
  await submit.click();
  await expect(
    page.getByText('Passwords do not match', { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel('Confirm Password', { exact: true })
    .fill('Browser-test-252!');
  await submit.click();
  await expect(page).toHaveURL('/onboarding');

  const finish = page.getByRole('button', {
    name: 'Complete registration',
    exact: true,
  });
  await finish.click();
  for (const message of [
    'Username must be at least 3 characters',
    'Native language is required',
    'Target language is required',
  ]) {
    await expect(
      page.getByRole('alert').filter({ hasText: message }),
    ).toBeVisible();
  }
  await page.getByLabel('Username', { exact: true }).fill('invalid username!');
  await finish.click();
  await expect(
    page.getByText(
      'Username can only contain letters, numbers, underscores, and hyphens',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page).toHaveURL('/onboarding');

  await page
    .getByLabel('Username', { exact: true })
    .fill(`e2e_${id.slice(0, 20)}`);
  await page
    .getByLabel('Native Language', { exact: true })
    .selectOption({ label: '🇺🇸 English' });
  await page
    .getByLabel('Target Language', { exact: true })
    .selectOption({ label: '🇪🇸 Spanish' });
  await finish.click();
  await expectDashboardReady(page);
});

test('deck and card validation recover, and persisted Markdown cannot execute an event handler', async ({
  page,
}) => {
  await registerAndOnboard(page);
  await page.getByRole('button', { name: 'My Library', exact: true }).click();
  await page.getByRole('button', { name: 'Create Deck', exact: true }).click();
  const saveDeck = page.getByRole('button', { name: 'Save Deck', exact: true });
  await saveDeck.click();
  await expect(
    page.getByText('Deck title is required', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('Deck Title', { exact: true }).fill('   ');
  await saveDeck.click();
  await expect(
    page.getByText('Deck title is required', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('Deck Title', { exact: true }).fill('x'.repeat(101));
  await page
    .getByLabel('Description (Optional)', { exact: true })
    .fill('x'.repeat(501));
  await saveDeck.click();
  await expect(
    page.getByText('Deck title cannot exceed 100 characters', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Description cannot exceed 500 characters', { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel('Deck Title', { exact: true })
    .fill('Validated browser cards');
  // Optional whitespace is empty after normalization, even above the limit.
  await page
    .getByLabel('Description (Optional)', { exact: true })
    .fill(' '.repeat(501));
  await saveDeck.click();
  await expect(saveDeck).not.toBeVisible();
  await page.getByRole('button', { name: 'Manage Cards', exact: true }).click();
  await page
    .getByRole('button', { name: 'Add Card', exact: true })
    .first()
    .click();

  const front = page.getByLabel('Front (Question, term, or prompt)', {
    exact: true,
  });
  const back = page.getByLabel('Back (Answer, definition, or translation)', {
    exact: true,
  });
  const saveCard = page.getByRole('button', { name: 'Save Card', exact: true });
  await saveCard.click();
  await expect(
    page.getByText('Front content is required', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Back content is required', { exact: true }),
  ).toBeVisible();
  await front.fill('   ');
  await back.fill('\n\t ');
  await saveCard.click();
  await expect(
    page.getByText('Front content is required', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Back content is required', { exact: true }),
  ).toBeVisible();
  await front.fill('x'.repeat(1001));
  await back.fill('x'.repeat(1001));
  await saveCard.click();
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Content cannot exceed 1000 characters' }),
  ).toHaveCount(2);
  await expect(front).toHaveAttribute('aria-invalid', 'true');
  await expect(back).toHaveAttribute('aria-invalid', 'true');

  // A valid image fires load without a failed network request. If sanitization
  // regresses, this handler leaves evidence without throwing a console error.
  await page.addInitScript(() =>
    Reflect.set(window, '__e2eXssExecuted', false),
  );
  await page.evaluate(() => Reflect.set(window, '__e2eXssExecuted', false));
  const payload =
    '<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" onload="window.__e2eXssExecuted=true" alt="XSS probe"> **Safe card text**';
  await front.fill(payload);
  await back.fill('Safe answer');
  await saveCard.click();
  await expect(saveCard).not.toBeVisible();
  await expect
    .poll(() =>
      page
        .getByRole('img', { name: 'XSS probe' })
        .evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
    )
    .toBe(true);
  expect(
    await page.evaluate(() => Reflect.get(window, '__e2eXssExecuted')),
  ).toBe(false);
  await expect(page.getByTestId('sync-status')).toHaveText('Synced');

  await page.reload();
  await expectDashboardReady(page);
  await page.getByRole('button', { name: 'My Library', exact: true }).click();
  await page.getByRole('button', { name: 'Manage Cards', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: 'Safe card text' });
  await expect(row).toContainText('Safe answer');
  await expect(row.getByRole('img', { name: 'XSS probe' })).toBeVisible();
  await expect(row.locator('[onload], script')).toHaveCount(0);
  await row.getByRole('button', { name: 'View', exact: true }).click();
  const preview = page.getByTestId('flashcard-front');
  await expect(preview).toContainText('Safe card text');
  await expect(preview.locator('[onload], script')).toHaveCount(0);
  await expect
    .poll(() =>
      preview
        .getByRole('img', { name: 'XSS probe' })
        .evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
    )
    .toBe(true);
  expect(
    await page.evaluate(() => Reflect.get(window, '__e2eXssExecuted')),
  ).toBe(false);
  await page.keyboard.press('Escape');

  // Confirm the hostile input was stored, rather than silently discarded.
  await row.getByRole('button', { name: 'Edit Card', exact: true }).click();
  await expect(front).toHaveValue(payload);
});
