import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { CommunityDecks } from '@/components/community-decks';

const mockPush = jest.fn();
const mockList = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('../lib/api-client', () => ({
  apiClient: {
    sharedDecks: {
      list: async ({ offset }: { offset: number }) => ({
        decks: (await mockList(offset)) as unknown[],
      }),
    },
  },
}));

const deck = {
  id: 'd1',
  title: 'Spanish A1',
  description: 'Everyday words',
  noteType: 'word',
  nativeLanguageId: '00000000-0000-0000-0000-000000000001',
  targetLanguageId: '00000000-0000-0000-0000-000000000002',
  cardCount: 12,
  owner: { username: 'ana' },
  updatedAt: 1,
};

describe('CommunityDecks', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockList.mockReset();
  });

  it('lists the shared decks and opens a preview', async () => {
    mockList.mockResolvedValue([deck]);
    const result = render(<CommunityDecks pageSize={2} />);

    expect(await result.findByText('Spanish A1')).toBeTruthy();
    expect(result.getByText(/12 cards · by @ana/)).toBeTruthy();
    fireEvent.press(result.getByLabelText('Open Spanish A1'));
    expect(mockPush).toHaveBeenCalledWith('/community/d1');
  });

  it('retries a failed load, and loads the next page when a page is full', async () => {
    mockList
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce([deck, { ...deck, id: 'd2', title: 'French' }])
      .mockResolvedValueOnce([{ ...deck, id: 'd3', title: 'German' }]);
    const result = render(<CommunityDecks pageSize={2} />);

    expect(await result.findByText('Network request failed')).toBeTruthy();
    fireEvent.press(result.getByText('Retry'));
    expect(await result.findByText('French')).toBeTruthy();

    fireEvent.press(result.getByText('Load more'));
    expect(await result.findByText('German')).toBeTruthy();
    expect(mockList).toHaveBeenLastCalledWith(2);
    expect(result.getByText('Spanish A1')).toBeTruthy();
    // A short page is the last one.
    expect(result.queryByText('Load more')).toBeNull();
  });

  it('says when there are none, and shows a failure', async () => {
    mockList.mockResolvedValue([]);
    const empty = render(<CommunityDecks pageSize={2} />);
    expect(await empty.findByText('No community decks yet.')).toBeTruthy();
    empty.unmount();

    mockList.mockRejectedValue(new Error('Network request failed'));
    const failed = render(<CommunityDecks pageSize={2} />);
    expect(await failed.findByText('Network request failed')).toBeTruthy();
  });
});
