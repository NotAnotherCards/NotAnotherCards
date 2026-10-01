import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { PublishPanel } from '@/components/publish-panel';

const IDLE = {
  status: 'idle',
  lastSyncAt: 1,
  error: null,
  cause: null,
  lastResult: {
    lease: 'acquired',
    resynced: false,
    rejected: 0,
    rejectedRecords: {},
  },
};
const mockSyncNow = jest.fn((): Promise<unknown> => Promise.resolve(IDLE));
const mockPublish = jest.fn();
const mockUnpublish = jest.fn();
const mockStatus = jest.fn();
const mockExplain = jest.fn();
const cards = [{ id: 'c1', front: 'gato' }];
const panel = (visibility: string) => (
  <PublishPanel deck={{ id: 'd1', visibility }} cards={cards} />
);
let mockSyncController: { syncNow: typeof mockSyncNow } | null = {
  syncNow: mockSyncNow,
};
jest.mock('../lib/database-provider', () => ({
  useSessionDatabase: () => ({
    manager: { tag: 'manager', database: { tag: 'db' } },
    syncController: mockSyncController,
  }),
}));
const mockConcerns = jest.fn<Promise<boolean>, [unknown, string, unknown]>(() =>
  Promise.resolve(true),
);
jest.mock('@repo/offline-db', () => ({
  ...jest.requireActual<object>('@repo/offline-db'),
  rejectionsConcernDeck: (db: unknown, deckId: string, rejected: unknown) =>
    mockConcerns(db, deckId, rejected),
}));
jest.mock('../lib/api-client', () => ({
  apiClient: {
    publishing: {
      publish: (id: string) => mockPublish(id),
      unpublish: (id: string) => mockUnpublish(id),
      moderationStatus: () => mockStatus(),
      explain: (
        id: string,
        input: unknown,
        onDelta: (delta: string) => void,
        options: unknown,
      ) => mockExplain(id, input, onDelta, options),
    },
  },
}));

describe('PublishPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSyncController = { syncNow: mockSyncNow };
    // reset, not clear: a queued once-value a test did not consume must
    // not leak into the next one
    mockSyncNow.mockReset();
    mockSyncNow.mockImplementation(() => Promise.resolve(IDLE));
    mockStatus.mockResolvedValue({ status: 'clear' });
    mockConcerns.mockImplementation(() => Promise.resolve(true));
  });

  it('publishes past a refusal that concerns another deck', async () => {
    mockSyncNow.mockResolvedValueOnce({
      ...IDLE,
      lastResult: {
        lease: 'acquired',
        resynced: false,
        rejected: 1,
        rejectedRecords: { user_decks: ['other'] },
      },
    });
    mockConcerns.mockResolvedValueOnce(false);
    mockPublish.mockResolvedValue({ published: true, warnings: [] });
    const result = render(panel('private'));

    await result.findByText('Private');
    fireEvent.press(result.getByText('Publish'));

    await waitFor(() => expect(mockPublish).toHaveBeenCalledWith('d1'));
    expect(mockConcerns).toHaveBeenCalledWith({ tag: 'db' }, 'd1', {
      user_decks: ['other'],
    });
  });

  it('sends nothing without a sync controller', async () => {
    mockSyncController = null;
    const result = render(panel('private'));

    await result.findByText('Private');
    fireEvent.press(result.getByText('Publish'));

    expect(
      await result.findByText('Not sent: Sync is unavailable.'),
    ).toBeTruthy();
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('offers Unpublish right after publishing, even when the sync after it failed', async () => {
    mockSyncNow
      .mockResolvedValueOnce(IDLE)
      .mockResolvedValueOnce({ ...IDLE, status: 'offline' });
    mockPublish.mockResolvedValue({ published: true, warnings: [] });
    const result = render(panel('private'));

    await result.findByText('Private');
    fireEvent.press(result.getByText('Publish'));

    expect(await result.findByText('Unpublish')).toBeTruthy();
    expect(result.getByText('Published to the community')).toBeTruthy();
  });

  it('a republished deck is no longer taken down, even when the refresh fails', async () => {
    mockStatus.mockResolvedValueOnce({
      status: 'blocked',
      reason: 'Removed after a report',
      flagged: [],
    });
    mockPublish.mockResolvedValue({ published: true, warnings: [] });
    mockSyncNow
      .mockResolvedValueOnce(IDLE)
      .mockResolvedValueOnce({ ...IDLE, status: 'offline' });
    const result = render(panel('public'));

    expect(await result.findByText('Taken down by moderation')).toBeTruthy();
    mockStatus.mockRejectedValue(new Error('offline'));
    fireEvent.press(result.getByText('Publish'));

    expect(await result.findByText('Unpublish')).toBeTruthy();
    expect(result.getByText('Published to the community')).toBeTruthy();
    expect(result.queryByText('Taken down by moderation')).toBeNull();
    expect(result.queryByText('Removed after a report')).toBeNull();
  });

  it('ends at a refusal: no second sync, and the refusal stays', async () => {
    mockPublish.mockResolvedValue({
      published: false,
      refusal: { flagged: [] },
    });
    const result = render(panel('private'));

    await result.findByText('Private');
    fireEvent.press(result.getByText('Publish'));

    expect(
      await result.findByText('Moderation refused the deck.'),
    ).toBeTruthy();
    expect(mockSyncNow).toHaveBeenCalledTimes(1);
    expect(result.queryByText(/catches up/)).toBeNull();
    expect(result.getByText('Publish')).toBeTruthy();
  });

  it('frees the earlier Why? when another card is asked about', async () => {
    mockPublish.mockResolvedValue({
      published: false,
      refusal: {
        flagged: [
          { cardId: 'c1', reason: 'hate speech' },
          { cardId: 'c2', reason: 'violence' },
        ],
      },
    });
    mockExplain.mockImplementation(() => new Promise<string>(() => {}));
    const result = render(
      <PublishPanel
        deck={{ id: 'd1', visibility: 'private' }}
        cards={[...cards, { id: 'c2', front: 'perro' }]}
      />,
    );

    await result.findByText('Private');
    fireEvent.press(result.getByText('Publish'));
    const whyGato = await result.findByLabelText('Why was gato flagged?');
    fireEvent.press(whyGato);
    await waitFor(() => expect(mockExplain).toHaveBeenCalledTimes(1));
    expect(whyGato.props.accessibilityState.disabled).toBe(true);

    fireEvent.press(result.getByLabelText('Why was perro flagged?'));
    await waitFor(() => expect(mockExplain).toHaveBeenCalledTimes(2));
    const [, , , options] = mockExplain.mock.calls[0] as [
      unknown,
      unknown,
      unknown,
      { signal: AbortSignal },
    ];
    expect(options.signal.aborted).toBe(true);
    expect(
      result.getByLabelText('Why was gato flagged?').props.accessibilityState
        .disabled,
    ).toBe(false);
  });

  it('publishes: syncs, calls the API, syncs again, and shows warnings', async () => {
    mockPublish.mockResolvedValue({
      published: true,
      warnings: [{ cardId: 'c1', reason: 'borderline' }],
    });
    const result = render(panel('private'));

    expect(await result.findByText('Private')).toBeTruthy();
    fireEvent.press(result.getByText('Publish'));

    await waitFor(() => expect(mockPublish).toHaveBeenCalledWith('d1'));
    expect(mockSyncNow).toHaveBeenCalledTimes(2);
    expect(await result.findByText('Warning, gato: borderline')).toBeTruthy();
  });

  it('sends nothing when the sync before it did not go through', async () => {
    mockSyncNow.mockResolvedValueOnce({ ...IDLE, status: 'offline' });
    const result = render(panel('private'));

    await result.findByText('Private');
    fireEvent.press(result.getByText('Publish'));

    expect(await result.findByText('Not sent: You are offline.')).toBeTruthy();
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('sends nothing while the server rejected some of the changes', async () => {
    mockSyncNow.mockResolvedValueOnce({
      ...IDLE,
      lastResult: {
        lease: 'acquired',
        resynced: false,
        rejected: 1,
        rejectedRecords: { user_cards: ['c1'] },
      },
    });
    const result = render(panel('private'));

    await result.findByText('Private');
    fireEvent.press(result.getByText('Publish'));

    expect(
      await result.findByText(/Not sent: The server did not accept/),
    ).toBeTruthy();
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('publishes only after the sync before it has finished', async () => {
    let finish = (_state: unknown) => {};
    mockSyncNow.mockImplementationOnce(
      () => new Promise((resolve) => (finish = resolve)),
    );
    mockPublish.mockResolvedValue({ published: true, warnings: [] });
    const result = render(panel('private'));

    await result.findByText('Private');
    fireEvent.press(result.getByText('Publish'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockPublish).not.toHaveBeenCalled();

    finish(IDLE);
    await waitFor(() => expect(mockPublish).toHaveBeenCalledWith('d1'));
  });

  it('says the device catches up when the sync after publishing fails', async () => {
    mockSyncNow
      .mockResolvedValueOnce(IDLE)
      .mockResolvedValueOnce({ ...IDLE, status: 'offline' });
    mockPublish.mockResolvedValue({ published: true, warnings: [] });
    const result = render(panel('private'));

    await result.findByText('Private');
    fireEvent.press(result.getByText('Publish'));

    expect(await result.findByText(/catches up at the next sync/)).toBeTruthy();
  });

  it('explains a flagged card as the answer streams in', async () => {
    mockPublish.mockResolvedValue({
      published: false,
      refusal: { flagged: [{ cardId: 'c1', reason: 'hate speech' }] },
    });
    mockExplain.mockImplementation(
      async (
        _id: string,
        input: { cardId: string; source: string },
        onDelta: (delta: string) => void,
      ) => {
        expect(input).toEqual({
          cardId: 'c1',
          reason: 'hate speech',
          source: 'working',
        });
        onDelta('The card ');
        onDelta('uses a slur.');
        return 'The card uses a slur.';
      },
    );
    const result = render(panel('private'));

    await result.findByText('Private');
    fireEvent.press(result.getByText('Publish'));
    fireEvent.press(await result.findByLabelText('Why was gato flagged?'));

    expect(await result.findByText('The card uses a slur.')).toBeTruthy();
    expect(mockExplain).toHaveBeenCalledTimes(1);
  });

  it('shows why an explanation failed', async () => {
    mockStatus.mockResolvedValue({
      status: 'blocked',
      flagged: [{ cardId: 'c1', reason: 'violence' }],
      warnings: [],
      results: [],
      moderatedAt: null,
    });
    mockExplain.mockRejectedValue(new Error('The explanation is too large.'));
    const result = render(panel('public'));

    fireEvent.press(await result.findByLabelText('Why was gato flagged?'));
    expect(
      await result.findByText('The explanation is too large.'),
    ).toBeTruthy();
    expect(mockExplain.mock.calls[0]?.[1]).toMatchObject({
      source: 'published',
    });
  });

  it('shows a refusal with the flagged cards named', async () => {
    mockPublish.mockResolvedValue({
      published: false,
      refusal: { flagged: [{ cardId: 'c1', reason: 'hate speech' }] },
    });
    const result = render(panel('private'));

    await result.findByText('Private');
    fireEvent.press(result.getByText('Publish'));

    expect(await result.findByText('gato: hate speech')).toBeTruthy();
    expect(result.getByText(/Moderation refused the deck/)).toBeTruthy();
    expect(result.getByText('Publish')).toBeTruthy();
  });

  it('unpublishes a public deck', async () => {
    mockUnpublish.mockResolvedValue(undefined);
    const result = render(panel('public'));

    expect(await result.findByText('Published to the community')).toBeTruthy();
    fireEvent.press(result.getByText('Unpublish'));
    await waitFor(() => expect(mockUnpublish).toHaveBeenCalledWith('d1'));
  });

  it('shows the reason of an operator takedown, which flags no cards', async () => {
    mockStatus.mockResolvedValue({
      status: 'blocked',
      reason: 'Removed after a report',
      flagged: [],
      warnings: [],
      results: [],
      moderatedAt: null,
    });
    const result = render(panel('public'));

    expect(await result.findByText('Taken down by moderation')).toBeTruthy();
    expect(result.getByText('Removed after a report')).toBeTruthy();
  });

  it('says when moderation took the deck down, with the reasons', async () => {
    mockStatus.mockResolvedValue({
      status: 'blocked',
      flagged: [{ cardId: 'c1', reason: 'violence' }],
      warnings: [],
      results: [],
      moderatedAt: null,
    });
    const result = render(panel('public'));

    expect(await result.findByText('Taken down by moderation')).toBeTruthy();
    expect(result.getByText('gato: violence')).toBeTruthy();
    expect(result.getByText('Publish')).toBeTruthy();
  });
});
