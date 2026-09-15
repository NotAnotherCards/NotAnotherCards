import React from 'react';
import { render } from '@testing-library/react-native';
import ReviewScreen from '@/app/review/[deckId]';

const mockUseSession = jest.fn();
const mockReviewSession = jest.fn((_props: { deckId: string }) => null);

jest.mock('../lib/auth-client', () => ({
  authClient: { useSession: () => mockUseSession() },
}));
jest.mock('../components/review-session', () => ({
  ReviewSession: (props: { deckId: string }) => mockReviewSession(props),
}));
jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    useLocalSearchParams: () => ({ deckId: 'deck-42' }),
    Redirect: ({ href }: { href: string }) =>
      React.createElement(Text, null, `redirect:${href}`),
    Stack: { Screen: () => null },
  };
});

describe('Review screen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('passes the route deck id to the review session', () => {
    mockUseSession.mockReturnValue({
      data: { user: { onBoardingComplete: true } },
      isPending: false,
    });

    render(<ReviewScreen />);

    expect(mockReviewSession).toHaveBeenCalledWith(
      expect.objectContaining({ deckId: 'deck-42' }),
    );
  });

  it('keeps the review route behind the session guard', () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false });

    const result = render(<ReviewScreen />);

    expect(result.getByText('redirect:/login')).toBeTruthy();
    expect(mockReviewSession).not.toHaveBeenCalled();
  });
});
