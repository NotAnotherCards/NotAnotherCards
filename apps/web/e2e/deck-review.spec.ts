import type { Page } from '@playwright/test';
import { test, expect, expectDashboardReady } from './fixtures.js';
import { registerAndOnboard } from './helpers.js';

async function createDeck(page: Page, title: string) {
  await page.getByRole('button', { name: 'My Library', exact: true }).click();
  await page.getByRole('button', { name: 'Create Deck', exact: true }).click();
  await page.getByLabel('Deck Title', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Save Deck', exact: true }).click();
  await page.getByTitle(title, { exact: true }).click();
  await expect(
    page.getByRole('heading', { name: title, exact: true }),
  ).toBeVisible();
}

async function addCard(page: Page, front: string, back: string) {
  // The empty catalog also offers an Add Card button; use the header action.
  await page
    .getByRole('button', { name: 'Add Card', exact: true })
    .first()
    .click();
  await page
    .getByLabel('Front (Question, term, or prompt)', { exact: true })
    .fill(front);
  await page
    .getByLabel('Back (Answer, definition, or translation)', { exact: true })
    .fill(back);
  await page.getByRole('button', { name: 'Save Card', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: front })).toContainText(
    back,
  );
}

test('a created card becomes due again at its scheduled time and can be reviewed again', async ({
  page,
}) => {
  test.setTimeout(60_000);
  // Keep Date deterministic while UI and network timers continue running.
  // Scheduling and due selection both run in this browser, not the API.
  let now = Math.floor(Date.now() / 10_000) * 10_000;
  await page.clock.install({ time: now });
  await page.clock.setFixedTime(now);
  await registerAndOnboard(page);
  await createDeck(page, 'Scheduled review');
  await addCard(page, 'Hasta mañana', 'See you tomorrow');
  await page
    .getByRole('button', { name: 'Back to Decks', exact: true })
    .click();
  await page.getByRole('button', { name: 'Start Review', exact: true }).click();

  for (const { rating, interval } of [
    { rating: 'Forgot', interval: 5 * 60_000 },
    { rating: 'Remembered', interval: 3 * 24 * 60 * 60_000 },
  ]) {
    await expect(page.getByTestId('review-card-front-content')).toHaveText(
      'Hasta mañana',
    );
    await page
      .getByRole('button', { name: 'Show answer', exact: true })
      .click();
    await expect(page.getByTestId('review-card-back-content')).toHaveText(
      'See you tomorrow',
    );
    await page
      .getByTestId('review-answer-buttons')
      .getByRole('button', { name: rating, exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Review complete', exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId('sync-status')).toHaveText('Synced');
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'No cards due', exact: true }),
    ).toBeVisible();

    now += interval;
    // A reload checks the persisted schedule immediately before the boundary.
    await page.clock.setFixedTime(now - 1);
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'No cards due', exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId('review-card')).toHaveCount(0);

    // Crossing the boundary should refresh the open page without a reload.
    await page.clock.setFixedTime(now);
    await page.clock.fastForward(10_000);
    await expect(page.getByTestId('review-card-front-content')).toHaveText(
      'Hasta mañana',
    );
    await expect(
      page.getByRole('button', { name: 'Show answer', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false');
  }

  await page.getByRole('button', { name: 'Show answer', exact: true }).click();
  await page
    .getByTestId('review-answer-buttons')
    .getByRole('button', { name: 'Knew it', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Review complete', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('sync-status')).toHaveText('Synced');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'No cards due', exact: true }),
  ).toBeVisible();
});

test('create and edit a deck and card with persistence after reload', async ({
  page,
}) => {
  await registerAndOnboard(page);
  await page.getByRole('button', { name: 'My Library', exact: true }).click();
  await page.getByRole('button', { name: 'Create Deck', exact: true }).click();
  await page
    .getByLabel('Deck Title', { exact: true })
    .fill('Travel vocabulary');
  await page
    .getByLabel('Description (Optional)', { exact: true })
    .fill('Useful travel phrases');
  await page.getByRole('button', { name: 'Save Deck', exact: true }).click();

  await page.getByTitle('Travel vocabulary', { exact: true }).hover();
  await page
    .getByRole('button', { name: 'Edit Deck Details', exact: true })
    .click();
  await expect(page.getByLabel('Deck Title', { exact: true })).toHaveValue(
    'Travel vocabulary',
  );
  await page.getByLabel('Deck Title', { exact: true }).fill('Spanish travel');
  await page
    .getByLabel('Description (Optional)', { exact: true })
    .fill('Phrases for my next trip');
  await page.getByRole('button', { name: 'Save Deck', exact: true }).click();
  await page.getByTitle('Spanish travel', { exact: true }).click();

  await page
    .getByRole('button', { name: 'Add Card', exact: true })
    .first()
    .click();
  await page
    .getByLabel('Front (Question, term, or prompt)', { exact: true })
    .fill('Hola');
  await page
    .getByLabel('Back (Answer, definition, or translation)', { exact: true })
    .fill('Hello');
  await page.getByRole('button', { name: 'Save Card', exact: true }).click();

  const row = page.getByRole('row').filter({ hasText: 'Hola' });
  await expect(row).toContainText('Hello');
  await row.getByRole('button', { name: 'Edit Card', exact: true }).click();
  await expect(
    page.getByLabel('Front (Question, term, or prompt)', { exact: true }),
  ).toHaveValue('Hola');
  await expect(
    page.getByLabel('Back (Answer, definition, or translation)', {
      exact: true,
    }),
  ).toHaveValue('Hello');
  await page
    .getByLabel('Front (Question, term, or prompt)', { exact: true })
    .fill('Buenos días');
  await page
    .getByLabel('Back (Answer, definition, or translation)', { exact: true })
    .fill('Good morning');
  await page.getByRole('button', { name: 'Save Card', exact: true }).click();
  await expect(
    page.getByRole('row').filter({ hasText: 'Buenos días' }),
  ).toContainText('Good morning');
  await expect(row).toHaveCount(0);
  await expect(page.getByTestId('sync-status')).toHaveText('Synced');

  await page.reload();
  await expectDashboardReady(page);
  await page.getByRole('button', { name: 'My Library', exact: true }).click();
  await expect(
    page.getByTitle('Travel vocabulary', { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText('Phrases for my next trip', { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('total-cards-badge')).toHaveText('1');
  await page.getByTitle('Spanish travel', { exact: true }).click();
  await expect(
    page.getByRole('row').filter({ hasText: 'Buenos días' }),
  ).toContainText('Good morning');
  await expect(page.getByRole('row').filter({ hasText: 'Hola' })).toHaveCount(
    0,
  );
});

test('reveal and rate every card, then retain the completed schedule after reload', async ({
  page,
}) => {
  await registerAndOnboard(page);
  await createDeck(page, 'Review practice');
  const cards = new Map([
    ['Uno', 'One'],
    ['Dos', 'Two'],
    ['Tres', 'Three'],
    ['Cuatro', 'Four'],
  ]);
  for (const [front, back] of cards) await addCard(page, front, back);
  await page
    .getByRole('button', { name: 'Back to Decks', exact: true })
    .click();
  await expect(page.getByTestId('total-cards-badge')).toHaveText('4');
  await page.getByRole('button', { name: 'Start Review', exact: true }).click();
  await expect(page).toHaveURL(/\/deck-review\?deckId=/);

  const reviewed = new Set<string>();
  for (const rating of ['Forgot', 'Struggled', 'Remembered', 'Knew it']) {
    const reveal = page.getByRole('button', {
      name: 'Show answer',
      exact: true,
    });
    await expect(reveal).toHaveAttribute('aria-pressed', 'false');
    const front = (
      await page.getByTestId('review-card-front-content').innerText()
    ).trim();
    expect(cards.has(front)).toBe(true);
    expect(reviewed.has(front), 'Each due card should be reviewed once').toBe(
      false,
    );
    await reveal.click();
    await expect(
      page.getByRole('button', { name: 'Answer is shown', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('review-card-back-content')).toHaveText(
      cards.get(front)!,
    );
    await page
      .getByTestId('review-answer-buttons')
      .getByRole('button', { name: rating, exact: true })
      .click();
    reviewed.add(front);
    if (reviewed.size < cards.size) {
      await expect(
        page.getByTestId('review-card-front-content'),
      ).not.toHaveText(front);
    }
  }
  await expect(
    page.getByRole('heading', { name: 'Review complete', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('sync-status')).toHaveText('Synced');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'No cards due', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('review-card')).toHaveCount(0);
});
