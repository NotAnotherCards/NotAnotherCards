import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ReviewSession } from '@/components/review-session';
import { saveReviewPreferences } from '@/lib/review-preferences';

const manager = { tag: 'manager' };
let mockManager: unknown = manager;
const mockRecord = jest.fn(() => Promise.resolve({ id: 'review-1' }));
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockReviewState: {
  deck: { id: string; title: string } | null;
  dueCards: Array<{
    id: string;
    note_id: string;
    front: string;
    back: string;
    due_at: number;
    scheduled_interval_minutes: number;
  }>;
  isLoading: boolean;
  error: Error | null;
  writes: { record: typeof mockRecord } | null;
};

jest.mock('../lib/database-provider', () => ({
  useSessionDatabase: () => ({ manager: mockManager }),
}));
jest.mock('../lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: { user: { id: 'user-1' } } }) },
}));
jest.mock('../lib/review', () => ({
  useReviewDeck: () => mockReviewState,
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack }),
  Stack: { Screen: () => null },
}));

beforeEach(() => {
  mockManager = manager;
  mockRecord.mockClear();
  mockReplace.mockClear();
  mockBack.mockClear();
  mockReviewState = {
    deck: { id: 'd1', title: 'Spanish' },
    dueCards: [
      {
        id: 'c1',
        note_id: 'n1',
        front: '**gato**',
        back: '`cat`',
        due_at: 1,
        scheduled_interval_minutes: 0,
      },
    ],
    isLoading: false,
    error: null,
    writes: { record: mockRecord },
  };
  // The kv-store mock is shared across tests in this file.
  saveReviewPreferences('user-1', {
    reviewMode: 'basic',
    showNextReviewInterval: false,
  });
});

describe('ReviewSession', () => {
  it('waits for the database manager', () => {
    mockManager = null;
    expect(
      render(<ReviewSession deckId="d1" />).queryByText('gato'),
    ).toBeNull();
  });

  it('flips back to the question when the card is tapped again', async () => {
    const result = render(<ReviewSession deckId="d1" />);

    expect(await result.findByText('gato')).toBeTruthy();
    fireEvent.press(result.getByLabelText('Show the answer'));
    expect(result.getByText('cat')).toBeTruthy();

    fireEvent.press(result.getByLabelText('Show the question'));
    expect(result.queryByText('cat')).toBeNull();
    expect(result.getByText('gato')).toBeTruthy();
  });

  it('follows the saved review preference: four labels and the next interval', async () => {
    saveReviewPreferences('user-1', {
      reviewMode: 'extended',
      showNextReviewInterval: true,
    });
    const result = render(<ReviewSession deckId="d1" />);

    fireEvent.press(await result.findByText('Show answer'));
    expect(result.getByText('Again')).toBeTruthy();
    expect(result.getByText('Hard')).toBeTruthy();
    expect(result.getByText('Good')).toBeTruthy();
    expect(result.getByText('Easy')).toBeTruthy();
    // A new card: Again schedules 5 minutes, Good three days.
    expect(result.getByText('5 min')).toBeTruthy();
    expect(result.getByText('3 days')).toBeTruthy();
  });

  it('renders Markdown, shows the back alone after flipping, and records a rating', async () => {
    const result = render(<ReviewSession deckId="d1" />);

    expect(await result.findByText('gato')).toHaveStyle({ fontWeight: 'bold' });
    fireEvent.press(result.getByText('Show answer'));
    expect(result.queryByText('gato')).toBeNull();
    expect(result.getByText('cat')).toHaveStyle({ fontFamily: 'monospace' });

    expect(result.getByText('Forgot')).toBeTruthy();
    expect(result.getByText('Remembered')).toBeTruthy();
    expect(result.queryByText('Hard')).toBeNull();
    expect(result.queryByText('Easy')).toBeNull();

    fireEvent.press(result.getByText('Remembered'));
    await waitFor(() => expect(mockRecord).toHaveBeenCalledWith('c1', 3));
    expect(await result.findByText('Review complete')).toBeTruthy();
  });

  it('shows a no-due-cards state and returns to the deck', async () => {
    mockReviewState.dueCards = [];
    const result = render(<ReviewSession deckId="d1" />);

    expect(await result.findByText('No cards due')).toBeTruthy();
    fireEvent.press(result.getByText('Back to deck'));
    expect(mockReplace).toHaveBeenCalledWith('/deck/d1');
  });

  it('keeps the answer visible so a failed rating can be retried', async () => {
    mockRecord.mockRejectedValueOnce(new Error('disk full'));
    const result = render(<ReviewSession deckId="d1" />);

    await result.findByText('gato');
    fireEvent.press(result.getByText('Show answer'));
    fireEvent.press(result.getByText('Forgot'));

    expect(await result.findByText('disk full')).toBeTruthy();
    expect(result.getByText('cat')).toBeTruthy();
    expect(result.getByText('Forgot')).toBeTruthy();
  });
});
