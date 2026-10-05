import { describe, expect, it, vi } from 'vitest';
import { createApiClient, ModerationTakedownError } from './client.js';
import { ApiError } from './transport.js';

const publishedAt = '2026-10-01T10:00:00.000Z';
const report = {
  id: 'r',
  deckId: 'a/b',
  reporterUserId: 'reporter',
  reason: 'Complaint.',
  snapshotPublishedAt: publishedAt,
  createdAt: publishedAt,
  publicationChanged: false,
};
const verdict = { flagged: [], warnings: [], results: [] };
const review = {
  deckId: 'a/b',
  status: 'blocked',
  reports: [report],
  currentSnapshotPublishedAt: publishedAt,
  moderatedAt: publishedAt,
  moderationVerdict: verdict,
  deck: {
    id: 'a/b',
    title: 'Published deck',
    description: null,
    noteType: 'basic',
    nativeLanguageId: null,
    targetLanguageId: null,
    cardCount: 1,
    owner: { username: 'owner' },
    updatedAt: new Date(publishedAt).getTime(),
    cards: [{ id: 'card', front: 'front', back: 'back' }],
  },
};
const setup = (body: unknown, status = 200) => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementation(
      async () => new Response(JSON.stringify(body), { status }),
    );
  const client = createApiClient({
    baseUrl: 'http://api.test',
    fetch,
    headers: () => ({ Cookie: 'session=test-session' }),
  });
  return { client, fetch };
};

describe('session moderation client', () => {
  it('validates capabilities and uses the existing session transport', async () => {
    const { client, fetch } = setup({ canModerate: true });
    expect(await client.operator.capabilities()).toEqual({ canModerate: true });
    expect(fetch).toHaveBeenCalledWith(
      'http://api.test/api/operator/capabilities',
      expect.objectContaining({ headers: { Cookie: 'session=test-session' } }),
    );
    await expect(
      setup({ canModerate: 'true' }).client.operator.capabilities(),
    ).rejects.toThrow();
  });

  it('validates report pages, converts timestamps and forwards pagination', async () => {
    const { client, fetch } = setup({
      reports: [
        {
          ...report,
          title: 'Published deck',
          owner: { username: 'owner' },
          status: 'visible',
          currentSnapshotPublishedAt: publishedAt,
          moderationStatus: 'visible',
          moderationVerdict: verdict,
          moderatedAt: null,
        },
      ],
    });
    const page = await client.operator.reports({ limit: 10, offset: 20 });
    expect(page.reports[0].snapshotPublishedAt).toEqual(new Date(publishedAt));
    expect(fetch).toHaveBeenCalledWith(
      'http://api.test/api/operator/deck-reports?limit=10&offset=20',
      expect.anything(),
    );
    await client.operator.reports();
    expect(fetch).toHaveBeenLastCalledWith(
      'http://api.test/api/operator/deck-reports',
      expect.anything(),
    );
    await expect(
      setup({
        reports: [{ ...report, status: 'public' }],
      }).client.operator.reports(),
    ).rejects.toThrow();
  });

  it('reads a retained blocked snapshot with an encoded ID and complete findings', async () => {
    const { client, fetch } = setup(review);
    const result = await client.operator.review('a/b');
    expect(result.currentSnapshotPublishedAt).toEqual(new Date(publishedAt));
    expect(result.deck?.cards).toEqual(review.deck.cards);
    expect(result.status).toBe('blocked');
    expect(fetch).toHaveBeenCalledWith(
      'http://api.test/api/operator/decks/a%2Fb',
      expect.anything(),
    );
    const unavailable = await setup({
      ...review,
      status: 'unavailable',
      deck: null,
      currentSnapshotPublishedAt: null,
    }).client.operator.review('a/b');
    expect(unavailable.deck).toBeNull();
    await expect(
      setup({
        ...review,
        deck: { ...review.deck, cards: [{ front: 'missing id' }] },
      }).client.operator.review('a/b'),
    ).rejects.toThrow();
  });

  it('sends only a validated reviewed timestamp and reason through the session transport', async () => {
    const { client, fetch } = setup({
      status: 'blocked',
      snapshotPublishedAt: publishedAt,
    });
    const input = {
      reason: '  Reviewed complaint.  ',
      expectedPublishedAt: publishedAt,
      operatorUserId: 'forged',
    };
    expect(await client.operator.takedown('a/b', input)).toEqual({
      status: 'blocked',
      snapshotPublishedAt: new Date(publishedAt),
    });
    expect(fetch).toHaveBeenCalledWith(
      'http://api.test/api/operator/decks/a%2Fb/takedown',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Cookie: 'session=test-session',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'Reviewed complaint.',
          expectedPublishedAt: publishedAt,
        }),
      }),
    );
    await expect(
      client.operator.takedown('a/b', {
        reason: ' ',
        expectedPublishedAt: publishedAt,
      }),
    ).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(
      setup({ status: 'visible' }).client.operator.takedown('a/b', {
        reason: 'Reason.',
        expectedPublishedAt: publishedAt,
      }),
    ).rejects.toThrow();
  });

  it.each([
    {
      statusCode: 409,
      code: 'PUBLICATION_CHANGED',
      message: 'Review again.',
      currentSnapshotPublishedAt: publishedAt,
    },
    {
      statusCode: 404,
      code: 'PUBLICATION_UNAVAILABLE',
      message: 'Unavailable.',
    },
  ])('exposes validated takedown state errors ($code)', async (body) => {
    const { client } = setup(body, body.statusCode);
    const error = await client.operator
      .takedown('a/b', { reason: 'Reason.', expectedPublishedAt: publishedAt })
      .catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ModerationTakedownError);
    expect(error).toMatchObject({
      status: body.statusCode,
      details: { code: body.code },
    });
    if (
      error instanceof ModerationTakedownError &&
      error.details.code === 'PUBLICATION_CHANGED'
    ) {
      expect(error.details.currentSnapshotPublishedAt).toEqual(
        new Date(publishedAt),
      );
    }
  });

  it('preserves ordinary access errors and rejects malformed conflict contracts', async () => {
    const input = { reason: 'Reason.', expectedPublishedAt: publishedAt };
    for (const status of [401, 403]) {
      await expect(
        setup(
          { message: 'Permission denied.' },
          status,
        ).client.operator.takedown('d', input),
      ).rejects.toMatchObject({ status, message: 'Permission denied.' });
    }
    const error = await setup(
      {
        code: 'PUBLICATION_CHANGED',
        statusCode: 409,
        message: 'Missing timestamp.',
      },
      409,
    )
      .client.operator.takedown('d', input)
      .catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(ModerationTakedownError);
  });
});
