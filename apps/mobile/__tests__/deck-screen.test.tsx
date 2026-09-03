import React from 'react';
import { render } from '@testing-library/react-native';
import DeckScreen from '@/app/deck/[id]';

const mockUseSession = jest.fn();
jest.mock('../lib/auth-client', () => ({
  authClient: { useSession: () => mockUseSession() },
}));

// The list has its own tests; this one is about the route: the id from the
// URL reaches CardList, and the session guard wraps it.
const mockCardList = jest.fn((_props: { deckId: string }) => null);
jest.mock('../components/card-list', () => ({
  CardList: (props: { deckId: string }) => mockCardList(props),
}));
jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    useLocalSearchParams: () => ({ id: 'd42' }),
    Redirect: ({ href }: { href: string }) =>
      React.createElement(Text, null, `redirect:${href}`),
    Stack: { Screen: () => null },
  };
});

describe('Deck screen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('passes the deck id from the URL to the card list', () => {
    mockUseSession.mockReturnValue({
      data: { user: { onBoardingComplete: true } },
      isPending: false,
    });
    render(<DeckScreen />);
    expect(mockCardList).toHaveBeenCalledWith(
      expect.objectContaining({ deckId: 'd42' }),
    );
  });

  it('redirects to login without a session and to onboarding with an unfinished profile', () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false });
    expect(render(<DeckScreen />).getByText('redirect:/login')).toBeTruthy();
    mockUseSession.mockReturnValue({
      data: { user: { onBoardingComplete: false } },
      isPending: false,
    });
    expect(
      render(<DeckScreen />).getByText('redirect:/onboarding'),
    ).toBeTruthy();
    expect(mockCardList).not.toHaveBeenCalled();
  });
});
