import {
  render,
  screen,
  act,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { App, router } from '../App';
import { authClient } from '@/lib/auth-client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mockSession = {
  session: {
    id: 'session-123',
    userId: 'user-123',
    expiresAt: new Date(Date.now() + 3600000),
    token: 'token-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  user: {
    id: 'user-123',
    email: 'john.doe@example.com',
    name: 'John Doe',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    onBoardingComplete: true,
  },
};

const mockDecks = [
  {
    id: 'deck-1',
    title: 'Spanish Basics',
    description: 'Learn common Spanish words',
    noteType: 'basic',
    cardCount: 50,
    owner: { username: 'polyglot99' },
    nativeLanguageId: null,
    targetLanguageId: null,
    updatedAt: Date.now(),
  },
];

vi.mock('@remelondb/core/react', () => ({
  useDatabaseState: () => ({ status: 'ready', error: null }),
  useQuery: () => ({ data: [], isLoading: false, error: null }),
  useDatabase: () => null,
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
  useSessionDatabase: () => ({
    manager: { state: { status: 'ready', error: null } },
    syncController: null,
    closeError: null,
  }),
}));

describe('Shared Decks Dashboard Feed', () => {
  beforeEach(async () => {
    window.history.pushState(null, '', '/dashboard');

    vi.mocked(authClient.getSession).mockResolvedValue({
      data: mockSession,
      error: null,
    });
    vi.mocked(authClient.useSession).mockReturnValue({
      data: mockSession,
      isPending: false,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof authClient.useSession>);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const response = (value: unknown, ok = true) =>
    ({ ok, json: async () => value }) as Response;

  it('renders community decks when api returns data', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/shared/decks')) {
        return Promise.resolve(response({ decks: mockDecks }));
      }
      return Promise.reject(new Error('unmocked request'));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await act(async () => {
      await router.navigate({ to: '/dashboard' });
    });

    expect(await screen.findByText('Community Decks')).toBeInTheDocument();
    expect(await screen.findByText('Spanish Basics')).toBeInTheDocument();
    expect(screen.getByText('Learn common Spanish words')).toBeInTheDocument();
    expect(screen.getByText('by @polyglot99')).toBeInTheDocument();
  });

  it('renders empty state when no community decks are available', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/shared/decks')) {
        return Promise.resolve(response({ decks: [] }));
      }
      return Promise.reject(new Error('unmocked request'));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await act(async () => {
      await router.navigate({ to: '/dashboard' });
    });

    expect(await screen.findByText('Community Decks')).toBeInTheDocument();
    expect(
      await screen.findByText('No community decks available yet.'),
    ).toBeInTheDocument();
  });

  it('handles importing a deck successfully', async () => {
    let completeImport!: (value: Response) => void;

    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (
          url.includes('/api/shared/decks') &&
          (!init || init.method === 'GET')
        ) {
          return Promise.resolve(response({ decks: mockDecks }));
        }
        if (
          url.includes('/api/shared/decks/deck-1/import') &&
          init?.method === 'POST'
        ) {
          return new Promise<Response>((resolve) => {
            completeImport = resolve;
          });
        }
        return Promise.reject(new Error(`unmocked request: ${url}`));
      });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await act(async () => {
      await router.navigate({ to: '/dashboard' });
    });

    // Wait for feed to load
    await screen.findByText('Spanish Basics');

    const importBtn = screen.getByRole('button', { name: 'Import' });
    expect(importBtn).not.toBeDisabled();

    // Click Import
    fireEvent.click(importBtn);

    // Button should be disabled during import
    await waitFor(() => expect(importBtn).toBeDisabled());

    // Resolve the import network request
    await act(async () => {
      completeImport(response({ deckId: 'new-deck-123' }));
    });

    // Button restores its state
    await waitFor(() => expect(importBtn).not.toBeDisabled());
  });
});
