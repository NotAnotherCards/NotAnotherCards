import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { DeckDetail } from '../components/deck/DeckDetail';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@/offline/syncProvider', () => ({
  useSyncController: () => ({ syncNow: vi.fn().mockResolvedValue(undefined) }),
  useSyncState: () => ({ status: 'ready', error: null }),
}));

describe('Deck Publishing Controls', () => {
  beforeEach(() => {
    mockDeck.visibility = 'private'; // Reset to private for each test
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

    const { rerender } = render(<DeckDetail deckId="deck-1" onBack={vi.fn()} />);

    const publishBtn = screen.getByRole('button', { name: 'Publish' });
    expect(publishBtn).toBeInTheDocument();

    fireEvent.click(publishBtn);

    // Verify loading state (it is disabled because the promise hasn't resolved)
    // We must wait because the onClick handler awaits syncNow() before calling publish()
    await waitFor(() => expect(publishBtn).toBeDisabled());

    // Resolve the promise
    await act(async () => {
      completePublish(response({ visibility: 'public' }));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/decks/deck-1/publish',
        expect.objectContaining({ method: 'POST' })
      );
      // Wait for state to settle to avoid act() warning
      expect(publishBtn).not.toBeDisabled();
    });

    // Simulate store reacting to sync (deck visibility updates locally)
    mockDeck.visibility = 'public';
    rerender(<DeckDetail deckId="deck-1" onBack={vi.fn()} />);

    expect(await screen.findByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
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

    const { rerender } = render(<DeckDetail deckId="deck-1" onBack={vi.fn()} />);

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
        expect.objectContaining({ method: 'POST' })
      );
      // Wait for state to settle to avoid act() warning
      expect(unpublishBtn).not.toBeDisabled();
    });

    // Simulate store reacting to sync
    mockDeck.visibility = 'private';
    rerender(<DeckDetail deckId="deck-1" onBack={vi.fn()} />);

    expect(await screen.findByRole('button', { name: 'Publish' })).toBeInTheDocument();
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
            flagged: [{ cardId: 'card-123456789', reason: 'Inappropriate language' }],
          },
          false,
          422
        )
      );
    });

    // Dialog should open
    expect(await screen.findByText('Could Not Publish Deck')).toBeInTheDocument();
    
    // Dialog should show the reason and the flagged card
    expect(screen.getByText('Violates community guidelines')).toBeInTheDocument();
    expect(screen.getByText('card-123')).toBeInTheDocument(); // slice(0, 8) in the UI
    expect(screen.getByText('Inappropriate language')).toBeInTheDocument();

    // The publish button should still be there (did not toggle to unpublish)
    const btn = screen.getByRole('button', { name: 'Publish' });
    expect(btn).toBeInTheDocument();
    await waitFor(() => expect(btn).not.toBeDisabled());
  });
});
