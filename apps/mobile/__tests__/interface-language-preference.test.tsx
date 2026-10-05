import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';
import {
  createDatabaseManager,
  Database,
  type DatabaseManager,
} from '@remelondb/core';
import { NodeSqliteDriver } from '@remelondb/driver-node';
import {
  createUserProfile,
  schema,
  UserProfile,
  updateUserProfile,
} from '@repo/offline-db';
import Storage from 'expo-sqlite/kv-store';
import { InterfaceLanguagePreference } from '@/components/interface-language-preference';
import LanguageEnforcer from '@/lib/language-enforcer';
import { renderWithLocale } from '@/lib/test-utils/render-with-locale';

const mockNotify = jest.fn();
jest.mock('../lib/database-provider', () => ({
  useSessionDatabase: () => ({
    syncController: { notifyLocalWrite: mockNotify },
  }),
}));
jest.mock('../lib/auth-client', () => ({ authClient: {} }));

let manager: DatabaseManager;
let db: Database;
beforeEach(async () => {
  mockNotify.mockClear();
  manager = createDatabaseManager({
    open: () =>
      Database.open({
        driver: new NodeSqliteDriver(),
        schema,
        modelClasses: [UserProfile],
        name: ':memory:',
      }),
  });
  db = await manager.init();
  await createUserProfile(db, {
    id: 'profile',
    username: 'learner',
    native_language_id: '00000000-0000-0000-0000-000000000003',
    target_language_id: '00000000-0000-0000-0000-000000000002',
  });
});
afterEach(async () => {
  cleanup();
  await manager.close();
});

it('saves the preference, wakes sync, and follows the profile in both languages after remount', async () => {
  const ui = (
    <>
      <LanguageEnforcer manager={manager} />
      <InterfaceLanguagePreference manager={manager} />
    </>
  );
  const screen = await renderWithLocale(ui, 'de');
  await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
  expect(screen.getByRole('switch').props.value).toBe(false);
  expect(screen.getByRole('switch').props.accessibilityLabel).toBe(
    screen.i18n.t('dashboard.settings.preferences.use_target_language'),
  );
  await act(async () => {
    fireEvent(screen.getByRole('switch'), 'valueChange', true);
  });
  await waitFor(() => expect(screen.i18n.resolvedLanguage).toBe('es'));
  expect(
    (await db.get(UserProfile).find('profile')).target_language_active,
  ).toBe(true);
  expect(mockNotify).toHaveBeenCalledTimes(1);
  expect(Storage.getItemSync('i18nextLng')).toBe('es');
  screen.unmount();

  const reopened = await renderWithLocale(ui, 'en');
  await waitFor(() => expect(reopened.i18n.resolvedLanguage).toBe('es'));
  expect(reopened.getByRole('switch').props.value).toBe(true);
  await act(async () => {
    fireEvent(reopened.getByRole('switch'), 'valueChange', false);
  });
  await waitFor(() => expect(reopened.i18n.resolvedLanguage).toBe('de'));
  expect(Storage.getItemSync('i18nextLng')).toBe('de');
});

it('keeps the saved choice and shows a translated error if the write fails, then allows retry', async () => {
  const screen = await renderWithLocale(
    <InterfaceLanguagePreference manager={manager} />,
    'es',
  );
  await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
  jest.spyOn(db, 'write').mockRejectedValueOnce(new Error('disk full'));
  await act(async () => {
    fireEvent(screen.getByRole('switch'), 'valueChange', true);
  });
  expect(
    screen.getByText(
      'No se pudo guardar la preferencia de idioma. Inténtalo de nuevo.',
    ),
  ).toBeTruthy();
  expect(screen.getByRole('switch').props.value).toBe(false);
  expect(mockNotify).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent(screen.getByRole('switch'), 'valueChange', true);
  });
  await waitFor(() =>
    expect(screen.getByRole('switch').props.value).toBe(true),
  );
  expect(screen.queryByRole('alert')).toBeNull();
});

it('reflects a profile change arriving from elsewhere without another write', async () => {
  const screen = await renderWithLocale(
    <InterfaceLanguagePreference manager={manager} />,
    'de',
  );
  await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
  await act(async () => {
    await updateUserProfile(db, { target_language_active: true });
  });
  await waitFor(() =>
    expect(screen.getByRole('switch').props.value).toBe(true),
  );
  expect(mockNotify).not.toHaveBeenCalled();
});
