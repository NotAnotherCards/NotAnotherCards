import {
  render,
  screen,
  act,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { DeckDetail } from '../components/deck/DeckDetail';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { SyncControllerState } from '@remelondb/core';

const synced: SyncControllerState = {
  status: 'idle',
  error: null,
  cause: null,
  lastSyncAt: 1,
  lastResult: { resynced: false, rejected: 0, rejectedRecords: {} },
};

const mockDeck = {
  id: 'deck-1',
  title: 'My Private Deck',
  description: 'Test deck',
  visibility: 'private',
  note_type: 'basic',
  native_language_id: null,
  target_language_id: null,
};

const mockStore = {
  ready: true,
  isTakenOver: false,
  decks: [mockDeck],
  getCardsForDeck: vi.fn(() => []),
  isBasicCard: vi.fn(),
  isWordCard: vi.fn(),
};

vi.mock('@/hooks/useStore', () => ({
  useStore: () => mockStore,
}));

const mockSyncController = {
  syncNow: vi
    .fn<() => Promise<SyncControllerState>>()
    .mockResolvedValue(synced),
};

vi.mock('@/offline/syncProvider', () => ({
  useSyncController: () => mockSyncController,
  useSyncState: () => ({ status: 'ready', error: null }),
}));

describe('Deck Publishing Controls', () => {
  beforeEach(() => {
    mockDeck.visibility = 'private'; // Reset to private for each test
    mockSyncController.syncNow.mockReset().mockResolvedValue(synced);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const response = (value: unknown, ok = true, status = 200) =>
    ({ ok, status, json: async () => value }) as Response;

  it('renders Publish button when deck is private and handles publishing successfully', async () => {
    let completePublish!: (value: Response) => void;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/decks/deck-1/publish')) {
        return new Promise<Response>((resolve) => {
          completePublish = resolve;
        });
      }
      return Promise.reject(new Error('unmocked request'));
    });
    vi.stubGlobal('fetch', fetchMock);

    const { rerender } = render(
      <DeckDetail deckId="deck-1" onBack={vi.fn()} />,
    );

    const publishBtn = screen.getByRole('button', { name: 'Publish' });
    expect(publishBtn).toBeInTheDocument();

    fireEvent.click(publishBtn);

    // Verify loading state (it is disabled because the promise hasn't resolved)
    // We must wait because the onClick handler awaits syncNow() before calling publish()
    await waitFor(() => expect(publishBtn).toBeDisabled());

    // Resolve the promise
    await act(async () => {
      completePublish(response({ visibility: 'public', warnings: [] }));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/decks/deck-1/publish',
        expect.objectContaining({ method: 'POST' }),
      );
      // Wait for state to settle to avoid act() warning
      expect(
        screen.getByRole('button', { name: 'Unpublish' }),
      ).not.toBeDisabled();
    });

    // Simulate store reacting to sync (deck visibility updates locally)
    mockDeck.visibility = 'public';
    rerender(<DeckDetail deckId="deck-1" onBack={vi.fn()} />);

    expect(
      await screen.findByRole('button', { name: 'Unpublish' }),
    ).toBeInTheDocument();
  });

  it('renders Unpublish button when deck is public and handles unpublishing successfully', async () => {
    mockDeck.visibility = 'public'; // Start as public

    let completeUnpublish!: (value: Response) => void;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/decks/deck-1/unpublish')) {
        return new Promise<Response>((resolve) => {
          completeUnpublish = resolve;
        });
      }
      return Promise.reject(new Error('unmocked request'));
    });
    vi.stubGlobal('fetch', fetchMock);

    const { rerender } = render(
      <DeckDetail deckId="deck-1" onBack={vi.fn()} />,
    );

    const unpublishBtn = screen.getByRole('button', { name: 'Unpublish' });
    expect(unpublishBtn).toBeInTheDocument();

    fireEvent.click(unpublishBtn);

    // Wait for the button to become disabled (waiting for syncNow microtask)
    await waitFor(() => expect(unpublishBtn).toBeDisabled());

    // Resolve the promise
    await act(async () => {
      completeUnpublish(response({ visibility: 'private' }));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/decks/deck-1/unpublish',
        expect.objectContaining({ method: 'POST' }),
      );
      // Wait for state to settle to avoid act() warning
      expect(
        screen.getByRole('button', { name: 'Publish' }),
      ).not.toBeDisabled();
    });

    // Simulate store reacting to sync
    mockDeck.visibility = 'private';
    rerender(<DeckDetail deckId="deck-1" onBack={vi.fn()} />);

    expect(
      await screen.findByRole('button', { name: 'Publish' }),
    ).toBeInTheDocument();
  });

  it('displays the moderation error dialog when publishing fails with 422', async () => {
    let completePublish!: (value: Response) => void;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/decks/deck-1/publish')) {
        return new Promise<Response>((resolve) => {
          completePublish = resolve;
        });
      }
      return Promise.reject(new Error('unmocked request'));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<DeckDetail deckId="deck-1" onBack={vi.fn()} />);

    const publishBtn = screen.getByRole('button', { name: 'Publish' });
    fireEvent.click(publishBtn);

    // Wait for the fetch to be called so completePublish is assigned
    await waitFor(() => expect(publishBtn).toBeDisabled());

    // Resolve with an error
    await act(async () => {
      completePublish(
        response(
          {
            reason: 'Violates community guidelines',
            flagged: [
              { cardId: 'card-123456789', reason: 'Inappropriate language' },
            ],
          },
          false,
          422,
        ),
      );
    });

    // Dialog should open
    expect(
      await screen.findByText('Could Not Publish Deck'),
    ).toBeInTheDocument();

    // Dialog should show the reason and the flagged card
    expect(
      screen.getByText('Violates community guidelines'),
    ).toBeInTheDocument();
    expect(screen.getByText('card-123')).toBeInTheDocument(); // slice(0, 8) in the UI
    expect(screen.getByText('Inappropriate language')).toBeInTheDocument();

    // The publish button should still be there (did not toggle to unpublish)
    const btn = screen.getByRole('button', { name: 'Publish' });
    expect(btn).toBeInTheDocument();
    await waitFor(() => expect(btn).not.toBeDisabled());
  });

  it('prevents double-click while syncNow is pending before publish', async () => {
    let completeSync!: (state: SyncControllerState) => void;
    mockSyncController.syncNow.mockImplementationOnce(() => {
      return new Promise<SyncControllerState>((resolve) => {
        completeSync = resolve;
      });
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValue(response({ visibility: 'public', warnings: [] }));
    vi.stubGlobal('fetch', fetchMock);

    render(<DeckDetail deckId="deck-1" onBack={vi.fn()} />);

    const publishBtn = screen.getByRole('button', { name: 'Publish' });

    // First click
    fireEvent.click(publishBtn);
    // Button should be disabled immediately due to isPendingPublishAction
    expect(publishBtn).toBeDisabled();

    // Try clicking again
    fireEvent.click(publishBtn);

    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/publish')),
    ).toHaveLength(0);

    // Resolve the sync
    await act(async () => {
      completeSync(synced);
    });

    // Wait for the publish fetch to finish
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Unpublish' }),
      ).not.toBeDisabled();
    });

    // Ensure syncNow was called twice (once before publish, once after publish)
    expect(mockSyncController.syncNow).toHaveBeenCalledTimes(2);
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).includes('/api/decks/deck-1/publish'),
      ),
    ).toHaveLength(1);
  });

  it.each(['publish', 'unpublish'] as const)(
    'stops %s when sync resolves offline',
    async (action) => {
      mockDeck.visibility = action === 'publish' ? 'private' : 'public';
      mockSyncController.syncNow.mockResolvedValueOnce({
        ...synced,
        status: 'offline',
        error: 'No connection',
      });
      const fetchMock = vi
        .fn()
        .mockResolvedValue(response({ status: 'clear' }));
      vi.stubGlobal('fetch', fetchMock);
      render(<DeckDetail deckId="deck-1" onBack={vi.fn()} />);
      fireEvent.click(
        screen.getByRole('button', {
          name: action === 'publish' ? 'Publish' : 'Unpublish',
        }),
      );
      expect(await screen.findByText('No connection')).toBeInTheDocument();
      expect(
        fetchMock.mock.calls.filter(([url]) =>
          String(url).endsWith(`/${action}`),
        ),
      ).toHaveLength(0);
    },
  );

  it.each(['idle', 'resync-required'] as const)(
    'stops publishing when %s includes rejected rows',
    async (status) => {
      mockSyncController.syncNow.mockResolvedValueOnce({
        ...synced,
        status,
        lastResult: {
          resynced: false,
          rejected: 1,
          rejectedRecords: { user_decks: ['deck-1'] },
        },
      });
      const fetchMock = vi
        .fn()
        .mockResolvedValue(response({ status: 'clear' }));
      vi.stubGlobal('fetch', fetchMock);
      render(<DeckDetail deckId="deck-1" onBack={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
      expect(
        await screen.findByText(/The deck's changes were not accepted/),
      ).toBeInTheDocument();
      expect(
        fetchMock.mock.calls.filter(([url]) =>
          String(url).endsWith('/publish'),
        ),
      ).toHaveLength(0);
    },
  );

  it.each(['publish', 'unpublish'] as const)(
    'retains %s success when the second sync fails',
    async (action) => {
      mockDeck.visibility = action === 'publish' ? 'private' : 'public';
      let completeSync!: (state: SyncControllerState) => void;
      mockSyncController.syncNow
        .mockResolvedValueOnce(synced)
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              completeSync = resolve;
            }),
        );
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockImplementation((url: string) =>
            Promise.resolve(
              response(
                url.endsWith('/publish')
                  ? { visibility: 'public', warnings: [] }
                  : { status: 'clear' },
              ),
            ),
          ),
      );
      render(<DeckDetail deckId="deck-1" onBack={vi.fn()} />);
      fireEvent.click(
        screen.getByRole('button', {
          name: action === 'publish' ? 'Publish' : 'Unpublish',
        }),
      );
      await waitFor(() =>
        expect(mockSyncController.syncNow).toHaveBeenCalledTimes(2),
      );
      const nextAction = action === 'publish' ? 'Unpublish' : 'Publish';
      expect(screen.getByRole('button', { name: nextAction })).toBeDisabled();
      await act(async () =>
        completeSync({
          ...synced,
          status: 'offline',
          error: 'Connection lost',
        }),
      );
      expect(
        await screen.findByText('Deck Updated, Sync Pending'),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          `The deck was ${action === 'publish' ? 'published' : 'unpublished'}. This device will update after the next successful sync.`,
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: nextAction }),
      ).not.toBeDisabled();
      expect(screen.queryByText(/Could Not .* Deck/)).not.toBeInTheDocument();
    },
  );

  it('does not publish when disposal leaves sync unfinished', async () => {
    mockSyncController.syncNow.mockResolvedValueOnce({
      ...synced,
      status: 'syncing',
    });
    const fetchMock = vi.fn().mockResolvedValue(response({ status: 'clear' }));
    vi.stubGlobal('fetch', fetchMock);
    render(<DeckDetail deckId="deck-1" onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(
      await screen.findByText(/Sync did not complete/),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/publish')),
    ).toHaveLength(0);
  });

  it('shows the stored takedown verdict to the owner', async () => {
    mockDeck.visibility = 'public';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/decks/deck-1/moderation')) {
          return Promise.resolve(
            response({
              status: 'blocked',
              reason: 'Reported deck did not pass the thorough check.',
              flagged: [
                {
                  cardId: 'card-123456789',
                  reason: 'Harassment',
                  classifier: 'moderation-thorough',
                },
              ],
              warnings: [
                {
                  cardId: 'card-warning-123',
                  reason: 'Sensitive topic',
                  classifier: 'moderation',
                },
              ],
              results: [
                {
                  cardId: 'card-123456789',
                  classifier: 'moderation',
                  verdict: 'safe',
                  categories: [],
                },
                {
                  cardId: 'card-123456789',
                  classifier: 'moderation-thorough',
                  verdict: 'unsafe',
                  categories: null,
                },
              ],
              moderatedAt: new Date().toISOString(),
            }),
          );
        }
        return Promise.reject(new Error(`unmocked request: ${url}`));
      }),
    );

    render(<DeckDetail deckId="deck-1" onBack={vi.fn()} />);

    expect(await screen.findByText('Deck taken down')).toBeInTheDocument();
    expect(
      screen.getByText('Reported deck did not pass the thorough check.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Classifier results')).toBeInTheDocument();
    expect(screen.getByText('safe')).toBeInTheDocument();
    expect(screen.getByText('unsafe')).toBeInTheDocument();
    expect(screen.getByText('Categories: none')).toBeInTheDocument();
    expect(screen.getByText('No category supplied')).toBeInTheDocument();
    expect(screen.getByText('moderation')).toBeInTheDocument();
    expect(screen.getByText('moderation-thorough')).toBeInTheDocument();
    // The server has made it private, so even a stale local public row offers
    // the recovery path instead of an ineffective Unpublish action.
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
  });

  it('shows publish warnings and streams an on-demand explanation', async () => {
    const encoder = new TextEncoder();
    const explanationResponse = {
      ok: true,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"type":"delta","delta":"The context may be sensitive. "}\n\n',
            ),
          );
          controller.enqueue(
            encoder.encode(
              'data: {"type":"result","explanation":"The context may be sensitive. Rephrase it neutrally."}\n\n',
            ),
          );
        },
      }),
    } as Response;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/moderation/explain')) {
        return Promise.resolve(explanationResponse);
      }
      if (url.includes('/moderation')) {
        return Promise.resolve(response({ status: 'clear' }));
      }
      if (url.includes('/publish')) {
        return Promise.resolve(
          response({
            visibility: 'public',
            warnings: [{ cardId: 'card-warning-123', reason: 'Violence' }],
          }),
        );
      }
      return Promise.reject(new Error(`unmocked request: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<DeckDetail deckId="deck-1" onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(
      await screen.findByText('Published with moderation warnings'),
    ).toBeInTheDocument();
    expect(screen.getByText('Violence')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Why?' }));

    expect(
      await screen.findByText(
        'The context may be sensitive. Rephrase it neutrally.',
      ),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/decks/deck-1/moderation/explain',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          cardId: 'card-warning-123',
          reason: 'Violence',
          source: 'published',
        }),
      }),
    );
  });

  it('restores stored publish warnings when the owner reopens the deck', async () => {
    mockDeck.visibility = 'public';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/decks/deck-1/moderation')) {
          return Promise.resolve(
            response({
              status: 'visible',
              warnings: [
                { cardId: 'card-warning-123', reason: 'Sensitive topic' },
              ],
            }),
          );
        }
        return Promise.reject(new Error(`unmocked request: ${url}`));
      }),
    );

    render(<DeckDetail deckId="deck-1" onBack={vi.fn()} />);

    expect(
      await screen.findByText('Published with moderation warnings'),
    ).toBeInTheDocument();
    expect(screen.getByText('Sensitive topic')).toBeInTheDocument();
  });
});
