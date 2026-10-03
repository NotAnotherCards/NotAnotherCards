import React from 'react';
import ReviewScreen from '@/app/review/[deckId]';
import { renderWithLocale } from '@/lib/test-utils/render-with-locale';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ deckId: 'missing-deck' }),
  Stack: {
    Screen: ({ options }: { options: { title: string } }) => {
      const { Text } = jest.requireActual('react-native');
      return <Text>{options.title}</Text>;
    },
  },
}));
jest.mock('../components/require-session', () => ({
  RequireSession: ({ children }: { children: React.ReactNode }) => children,
}));
// No deck title is available while loading or after a failed lookup.
jest.mock('../components/review-session', () => ({
  ReviewSession: () => null,
}));

it.each([
  ['en', 'Review'],
  ['de', 'Wiederholung'],
  ['es', 'Repaso'],
  ['ru', 'Повторение'],
] as const)(
  'has a fallback review title in %s without a loaded deck',
  async (locale, title) => {
    const screen = await renderWithLocale(<ReviewScreen />, locale);
    expect(screen.getByText(title)).toBeTruthy();
  },
);
