import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import '@/lib/i18n';
import { Settings, initials } from '@/components/settings';
import { loadReviewPreferences } from '@/lib/review-preferences';
import { renderWithLocale } from '@/lib/test-utils/render-with-locale';

const mockUseSession = jest.fn();
const mockSignOut = jest.fn();
const mockReplace = jest.fn();
jest.mock('../lib/auth-client', () => ({
  authClient: {
    useSession: () => mockUseSession(),
    signOut: (...args: unknown[]) => mockSignOut(...args),
  },
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));
// No account database in this test: the header renders without @username
// and the preferences only need the session's user id.
jest.mock('../lib/database-provider', () => ({
  useSessionDatabase: () => ({ manager: null, syncController: null }),
}));
jest.mock('../components/two-factor-security', () => ({
  TwoFactorSecurity: () => null,
}));
jest.mock('../components/ui/icon', () => ({
  LogOutIcon: () => null,
  SettingsIcon: () => null,
}));

describe('initials', () => {
  it('takes the first letters of up to two words', () => {
    expect(initials('Jane Doe')).toBe('JD');
    expect(initials('jane')).toBe('J');
    expect(initials('Jane Mary Doe')).toBe('JM');
    expect(initials(undefined)).toBe('U');
  });
});

describe('Settings', () => {
  it('translates the section tabs and keeps the selection when the locale changes', async () => {
    const screen = await renderWithLocale(<Settings />, 'de');
    expect(screen.getByLabelText('Einstellungsbereiche')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Profil & Sprachen' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Einstellungen' })).toBeTruthy();
    fireEvent.press(screen.getByRole('tab', { name: 'Sicherheit' }));
    await act(async () => {
      await screen.i18n.changeLanguage('es');
    });
    expect(screen.getByRole('tab', { name: 'Perfil e Idiomas' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Preferencias' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Seguridad' })).toBeSelected();
    expect(screen.getByLabelText('Secciones de ajustes')).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Sicherheit' })).toBeNull();
  });
  beforeEach(() => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'user-settings',
          name: 'Jane Doe',
          email: 'jane@example.com',
        },
      },
      isPending: false,
    });
  });

  it('shows the account header and the saved preferences', () => {
    const { getByText, getByLabelText, queryByLabelText } = render(
      <Settings />,
    );
    fireEvent.press(getByText('Preferences'));
    expect(getByText('JD')).toBeTruthy();
    expect(getByText('Jane Doe')).toBeTruthy();
    expect(getByText(/jane@example.com/)).toBeTruthy();
    expect(getByLabelText('Review mode')).toBeTruthy();
    expect(queryByLabelText('Language')).toBeNull();
    expect(getByText('Basic').props.className).toContain('font-semibold');
  });

  it('persists a changed review mode and interval choice for the user', () => {
    const { getByText, getByLabelText } = render(<Settings />);
    fireEvent.press(getByText('Preferences'));
    fireEvent.press(getByText('Extended'));
    fireEvent(getByLabelText('Show next review interval'), 'valueChange', true);
    expect(loadReviewPreferences('user-settings')).toEqual({
      reviewMode: 'extended',
      showNextReviewInterval: true,
    });
    expect(getByText('Extended').props.className).toContain('font-semibold');
  });

  // The sign-out cases moved here from the dashboard with the button (#237).
  it('signs out and returns to login', async () => {
    mockSignOut.mockResolvedValueOnce({ data: { success: true }, error: null });
    const alertSpy = jest
      .spyOn(require('react-native').Alert, 'alert')
      .mockImplementation(() => {});
    const { getByText } = render(<Settings />);
    fireEvent.press(getByText('Log out'));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    expect(mockReplace).toHaveBeenCalledWith('/login');
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('tells the truth when sign-out fails, and still returns to login', async () => {
    mockSignOut.mockResolvedValueOnce({ error: { status: 500 } });
    const alertSpy = jest
      .spyOn(require('react-native').Alert, 'alert')
      .mockImplementation(() => {});
    const { getByText } = render(<Settings />);
    fireEvent.press(getByText('Log out'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
    expect(alertSpy).toHaveBeenCalledWith(
      'Signed out on this device only',
      expect.stringMatching(/may stay active/),
    );
    alertSpy.mockRestore();
  });
});
