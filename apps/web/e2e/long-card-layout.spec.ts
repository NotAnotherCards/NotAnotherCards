import type { Locator, Page } from '@playwright/test';
import { CARD_FACE_MAX_LENGTH } from '@repo/schemas';
import { test, expect } from './fixtures.js';
import { registerAndOnboard } from './helpers.js';

function longContent(word: string, marker: string) {
  const suffix = ` **${marker}**`;
  return (
    `${word} `
      .repeat(CARD_FACE_MAX_LENGTH)
      .slice(0, CARD_FACE_MAX_LENGTH - suffix.length) + suffix
  );
}

function longListContent(marker: string) {
  const heading = '## List answer\n\n';
  const suffix = ` **${marker}**`;
  const prefixes = Array.from(
    { length: 6 },
    (_, index) => `- item ${index + 1} `,
  );
  const separatorsLength = prefixes.length - 1;
  const fillLength =
    CARD_FACE_MAX_LENGTH -
    heading.length -
    prefixes.join('').length -
    separatorsLength -
    suffix.length;
  const baseLength = Math.floor(fillLength / prefixes.length);
  const remainder = fillLength % prefixes.length;
  const lines = prefixes.map((prefix, index) => {
    const length = baseLength + (index < remainder ? 1 : 0);
    return `${prefix}${'list '.repeat(length).slice(0, length)}${
      index === prefixes.length - 1 ? suffix : ''
    }`;
  });
  return `${heading}${lines.join('\n')}`;
}

async function createDeck(page: Page) {
  await page.getByRole('button', { name: 'My Library', exact: true }).click();
  await page.getByRole('button', { name: 'Create Deck', exact: true }).click();
  await page.getByLabel('Deck Title', { exact: true }).fill('Layout limits');
  await page.getByRole('button', { name: 'Save Deck', exact: true }).click();
  await page.getByTitle('Layout limits', { exact: true }).click();
}

async function addCard(page: Page, front: string, back: string) {
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
  const renderedFront = front.replaceAll('**', '');
  const renderedBack = back.replaceAll('**', '');
  await expect(
    page.getByRole('row').filter({ hasText: renderedFront }),
  ).toContainText(renderedBack);
}

async function expectNoOverflow(content: Locator) {
  const metrics = await content.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
}

async function expectContained(content: Locator, container: Locator) {
  await expectNoOverflow(content);
  const [contentBox, containerBox] = await Promise.all([
    content.boundingBox(),
    container.boundingBox(),
  ]);
  expect(contentBox).not.toBeNull();
  expect(containerBox).not.toBeNull();
  expect(contentBox!.x).toBeGreaterThanOrEqual(containerBox!.x);
  expect(contentBox!.y).toBeGreaterThanOrEqual(containerBox!.y);
  expect(contentBox!.x + contentBox!.width).toBeLessThanOrEqual(
    containerBox!.x + containerBox!.width,
  );
  expect(contentBox!.y + contentBox!.height).toBeLessThanOrEqual(
    containerBox!.y + containerBox!.height,
  );
}

async function expectMarkerInsideViewport(container: Locator, marker: string) {
  const markerBox = await container
    .getByText(marker, { exact: true })
    .boundingBox();
  const viewport = container.page().viewportSize();
  expect(markerBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(markerBox!.x).toBeGreaterThanOrEqual(0);
  expect(markerBox!.y).toBeGreaterThanOrEqual(0);
  expect(markerBox!.x + markerBox!.width).toBeLessThanOrEqual(viewport!.width);
  expect(markerBox!.y + markerBox!.height).toBeLessThanOrEqual(
    viewport!.height,
  );
}

test('long front and back content stays readable after the card flips', async ({
  page,
}) => {
  await registerAndOnboard(page);
  await createDeck(page);

  const cards = [
    {
      front: longContent('question', 'FRONT-END-A'),
      back: 'Short answer A',
      frontMarker: 'FRONT-END-A',
      backMarker: null,
    },
    {
      front: 'Short question B',
      back: longContent('answer', 'BACK-END-B'),
      frontMarker: null,
      backMarker: 'BACK-END-B',
    },
    {
      front: longContent('prompt', 'FRONT-END-C'),
      back: longContent('response', 'BACK-END-C'),
      frontMarker: 'FRONT-END-C',
      backMarker: 'BACK-END-C',
    },
    {
      front: 'List question D',
      back: longListContent('LIST-END-D'),
      frontMarker: null,
      backMarker: 'LIST-END-D',
    },
  ];

  for (const card of cards) await addCard(page, card.front, card.back);
  await page
    .getByRole('button', { name: 'Back to Decks', exact: true })
    .click();
  await page.getByRole('button', { name: 'Start Review', exact: true }).click();

  for (const card of cards) {
    const frontContent = page.getByTestId('review-card-front-content');
    await expect(frontContent).toHaveText(card.front.replaceAll('**', ''));
    const frontFace = frontContent.locator(
      'xpath=ancestor::*[@aria-hidden="false"][1]',
    );
    await expectContained(frontContent, frontFace);
    if (card.frontMarker) {
      await expectMarkerInsideViewport(frontFace, card.frontMarker);
    }
    const frontBox = await frontFace.boundingBox();
    expect(frontBox).not.toBeNull();

    await page
      .getByRole('button', { name: 'Show answer', exact: true })
      .click();
    await page.getByTestId('review-card-flip').evaluate(async (element) => {
      await Promise.all(
        element.getAnimations().map((animation) => animation.finished),
      );
    });

    // The answer side is one card of the same size, showing only the back.
    const backContent = page.getByTestId('review-card-back-content');
    const answerFace = backContent.locator(
      'xpath=ancestor::*[@aria-hidden="false"][1]',
    );
    await expect(answerFace.locator('.markdown-content')).toHaveCount(1);
    await expectContained(backContent, answerFace);

    const answerBox = await answerFace.boundingBox();
    expect(answerBox).not.toBeNull();
    for (const side of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(answerBox![side] - frontBox![side])).toBeLessThanOrEqual(
        1,
      );
    }

    if (card.backMarker) {
      await expectMarkerInsideViewport(answerFace, card.backMarker);
    }

    const answerButtons = page
      .getByTestId('review-answer-buttons')
      .getByRole('button');
    await expect(answerButtons).toHaveCount(4);
    const buttonBoxes = [];
    for (const button of await answerButtons.all()) {
      await expect(button).toBeVisible();
      await expect(button).toBeEnabled();
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      buttonBoxes.push(box!);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(
        page.viewportSize()!.width,
      );
      expect(box!.y + box!.height).toBeLessThanOrEqual(
        page.viewportSize()!.height,
      );
    }
    expect(new Set(buttonBoxes.map((box) => Math.round(box.y))).size).toBe(1);
    await answerButtons.nth(2).click();
  }
});
