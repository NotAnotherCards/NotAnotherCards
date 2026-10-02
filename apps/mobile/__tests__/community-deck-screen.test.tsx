import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import CommunityDeckScreen from '@/app/community/[id]';
import { finishTwoFactorChallenge } from '@/lib/two-factor-challenge';

const mockBack = jest.fn();
const mockDismissTo = jest.fn();
const mockPreview = jest.fn();
const mockImport = jest.fn();
const mockReport = jest.fn();
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
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    dismissTo: mockDismissTo,
    push: jest.fn(),
  }),
  useLocalSearchParams: () => ({ id: 'd1' }),
  Stack: { Screen: () => null },
}));
jest.mock('../lib/api-client', () => ({
  apiClient: {
    sharedDecks: {
      preview: async (id: string) => ({ deck: await mockPreview(id) }),
      import: (id: string) => mockImport(id),
      report: (id: string, reason: string) => mockReport(id, reason),
    },
  },
}));
let mockSyncController: { syncNow: typeof mockSyncNow } | null = {
  syncNow: mockSyncNow,
};
jest.mock('../lib/database-provider', () => ({
  useSessionDatabase: () => ({
    manager: null,
    syncController: mockSyncController,
  }),
}));
jest.mock('../lib/auth-client', () => ({
  authClient: {
    useSession: () => ({
      data: { user: { id: 'u1', onBoardingComplete: true } },
      isPending: false,
      error: null,
    }),
  },
}));

const deck = {
  id: 'd1',
  title: 'Spanish A1',
  description: null,
  noteType: 'basic',
  nativeLanguageId: null,
  targetLanguageId: null,
  cardCount: 1,
  owner: { username: 'ana' },
  updatedAt: 1,
  cards: [{ front: 'hola', back: 'hello' }],
};

describe('CommunityDeckScreen', () => {
  beforeEach(() => {
    // RequireSession waits for the 2FA challenge state (#384); none is pending.
    finishTwoFactorChallenge();
    jest.clearAllMocks();
    mockSyncController = { syncNow: mockSyncNow };
    mockSyncNow.mockImplementation(() => Promise.resolve(IDLE));
    mockPreview.mockResolvedValue(deck);
    mockImport.mockResolvedValue({ deckId: 'copy' });
    mockReport.mockResolvedValue(undefined);
  });

  it('shows the cards, imports, syncs and returns to My decks', async () => {
    const result = render(<CommunityDeckScreen />);

    expect(await result.findByText('hola')).toBeTruthy();
    expect(result.getByText('hello')).toBeTruthy();
    fireEvent.press(result.getByText('Import'));

    await waitFor(() =>
      expect(mockDismissTo).toHaveBeenCalledWith({
        pathname: '/dashboard',
        params: { tab: 'library', section: 'mine' },
      }),
    );
    expect(mockImport).toHaveBeenCalledWith('d1');
    expect(mockSyncNow).toHaveBeenCalledTimes(1);
  });

  it('keeps the import when the sync fails and retries only the sync', async () => {
    mockSyncNow
      .mockResolvedValueOnce({ ...IDLE, status: 'offline' })
      .mockResolvedValueOnce(IDLE);
    const result = render(<CommunityDeckScreen />);

    await result.findByText('hola');
    fireEvent.press(result.getByText('Import'));

    expect(await result.findByText(/after the next sync/)).toBeTruthy();
    expect(mockDismissTo).not.toHaveBeenCalled();
    fireEvent.press(result.getByText('Retry sync'));

    await waitFor(() =>
      expect(mockDismissTo).toHaveBeenCalledWith({
        pathname: '/dashboard',
        params: { tab: 'library', section: 'mine' },
      }),
    );
    expect(mockImport).toHaveBeenCalledTimes(1);
    expect(mockSyncNow).toHaveBeenCalledTimes(2);
  });

  it('keeps the import and offers a retry when there is no sync', async () => {
    mockSyncController = null;
    const result = render(<CommunityDeckScreen />);

    await result.findByText('hola');
    fireEvent.press(result.getByText('Import'));

    expect(await result.findByText(/Sync is unavailable/)).toBeTruthy();
    expect(result.getByText('Retry sync')).toBeTruthy();
    expect(mockDismissTo).not.toHaveBeenCalled();
    expect(mockImport).toHaveBeenCalledTimes(1);
  });

  it('does not navigate when the user left before the import finished', async () => {
    let finish = (_state: unknown) => {};
    mockSyncNow.mockImplementationOnce(
      () => new Promise((resolve) => (finish = resolve)),
    );
    const result = render(<CommunityDeckScreen />);

    await result.findByText('hola');
    fireEvent.press(result.getByText('Import'));
    await waitFor(() => expect(mockSyncNow).toHaveBeenCalled());
    result.unmount();
    finish(IDLE);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(mockDismissTo).not.toHaveBeenCalled();
  });

  it('reports with a reason, asked in place', async () => {
    const result = render(<CommunityDeckScreen />);

    await result.findByText('hola');
    fireEvent.press(result.getByText('Report'));
    fireEvent.changeText(result.getByLabelText('Reason'), ' spam ');
    fireEvent.press(result.getByText('Send report'));

    await waitFor(() => expect(mockReport).toHaveBeenCalledWith('d1', 'spam'));
    expect(
      await result.findByText('Thanks, the deck is reported.'),
    ).toBeTruthy();
  });

  it('retries a preview that failed to load', async () => {
    mockPreview.mockRejectedValueOnce(new Error('Network request failed'));
    const result = render(<CommunityDeckScreen />);

    expect(await result.findByText('Network request failed')).toBeTruthy();
    fireEvent.press(result.getByText('Retry'));
    expect(await result.findByText('hola')).toBeTruthy();
    expect(result.queryByText('Network request failed')).toBeNull();
  });

  it('shows the failure of an import and keeps the buttons', async () => {
    mockImport.mockRejectedValue(new Error('Deck not found'));
    const result = render(<CommunityDeckScreen />);

    await result.findByText('hola');
    fireEvent.press(result.getByText('Import'));

    expect(await result.findByText('Deck not found')).toBeTruthy();
    expect(result.getByText('Import')).toBeTruthy();
    expect(mockDismissTo).not.toHaveBeenCalled();
  });
});
