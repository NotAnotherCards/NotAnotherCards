import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Library } from '@/components/library';

jest.mock('../components/deck-list', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    DeckList: ({ createRequestKey }: { createRequestKey: number }) => (
      <Text>my decks list {createRequestKey}</Text>
    ),
  };
});
jest.mock('../components/community-decks', () => {
  const { Text } = jest.requireActual('react-native');
  return { CommunityDecks: () => <Text>community list</Text> };
});

describe('Library', () => {
  it('opens on my decks and switches to the community decks', () => {
    const result = render(<Library />);

    expect(result.getByText('my decks list 0')).toBeTruthy();
    expect(result.queryByText('community list')).toBeNull();

    // The plus asks the list for its create form, and only shows here.
    fireEvent.press(result.getByLabelText('Create deck'));
    expect(result.getByText('my decks list 1')).toBeTruthy();

    fireEvent.press(result.getByRole('tab', { name: 'Community' }));
    expect(result.getByText('community list')).toBeTruthy();
    expect(result.queryByText(/my decks list/)).toBeNull();
    expect(result.queryByLabelText('Create deck')).toBeNull();

    // Back on my decks, the earlier request is forgotten.
    fireEvent.press(result.getByRole('tab', { name: 'My decks' }));
    expect(result.getByText('my decks list 0')).toBeTruthy();
  });
});
