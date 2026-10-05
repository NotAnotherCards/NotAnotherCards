import React from 'react';
import i18n from '@/lib/i18n';
import { act, fireEvent } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { router, Stack } from 'expo-router';
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
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });
  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });
  });
  it('translates the library tabs and create button in German', async () => {
    await i18n.changeLanguage('de');
    const result = renderRouter(
      { dashboard: Library },
      { initialUrl: '/dashboard' },
    );
    expect(result.getByRole('tab', { name: 'Meine Stapel' })).toBeTruthy();
    expect(result.getByLabelText('Stapel erstellen')).toBeTruthy();
    expect(result.queryByText('Stapel erstellen')).toBeNull();
    expect(result.getByLabelText('Stapel erstellen').props.className).toContain(
      'w-12',
    );
    fireEvent.press(result.getByRole('tab', { name: 'Gemeinschaft' }));
    expect(result.getByText('community list')).toBeTruthy();
  });
  it('opens on my decks and switches to the community decks', () => {
    const result = renderRouter(
      { dashboard: Library },
      { initialUrl: '/dashboard' },
    );

    expect(result.getByText('my decks list 0')).toBeTruthy();
    expect(result.queryByText('community list')).toBeNull();

    // The plus asks the list for its create form, and only shows here.
    fireEvent.press(result.getByLabelText('Create Deck'));
    expect(result.getByText('my decks list 1')).toBeTruthy();

    fireEvent.press(result.getByRole('tab', { name: 'Community' }));
    expect(result.getByText('community list')).toBeTruthy();
    expect(result.queryByText(/my decks list/)).toBeNull();
    expect(result.queryByLabelText('Create Deck')).toBeNull();

    // Back on my decks, the earlier request is forgotten.
    fireEvent.press(result.getByRole('tab', { name: 'My decks' }));
    expect(result.getByText('my decks list 0')).toBeTruthy();
  });

  it('returns to My decks without remounting the dashboard after import', async () => {
    let mounts = 0;
    function Dashboard() {
      React.useEffect(() => {
        mounts += 1;
      }, []);
      return <Library />;
    }
    const result = renderRouter(
      {
        _layout: () => <Stack />,
        dashboard: Dashboard,
        'community/[id]': () => null,
      },
      { initialUrl: '/dashboard' },
    );
    for (const id of ['d1', 'd2']) {
      fireEvent.press(result.getByRole('tab', { name: 'Community' }));
      expect(result.getByText('community list')).toBeTruthy();
      await act(async () => router.push(`/community/${id}`));
      await act(async () =>
        router.dismissTo({
          pathname: '/dashboard',
          params: { tab: 'library', section: 'mine' },
        }),
      );
      expect(result.getByText('my decks list 0')).toBeTruthy();
      expect(result.queryByText('community list')).toBeNull();
      expect(mounts).toBe(1);
    }
  });
});
