import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Settings, initials } from '@/components/settings';
import { loadReviewPreferences } from '@/lib/review-preferences';

const mockUseSession = jest.fn();
jest.mock('../lib/auth-client', () => ({
  authClient: { useSession: () => mockUseSession() },
}));
// No account database in this test: the header renders without @username
// and the preferences only need the session's user id.
jest.mock('../lib/database-provider', () => ({
  useSessionDatabase: () => ({ manager: null, syncController: null }),
}));
jest.mock('lucide-react-native', () => ({ Settings: () => null }));

describe('initials', () => {
  it('takes the first letters of up to two words', () => {
    expect(initials('Jane Doe')).toBe('JD');
    expect(initials('jane')).toBe('J');
    expect(initials('Jane Mary Doe')).toBe('JM');
    expect(initials(undefined)).toBe('U');
  });
});

describe('Settings', () => {
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
    const { getByText, getByLabelText } = render(<Settings />);
    expect(getByText('JD')).toBeTruthy();
    expect(getByText('Jane Doe')).toBeTruthy();
    expect(getByText(/jane@example.com/)).toBeTruthy();
    expect(getByLabelText('Review mode')).toBeTruthy();
    expect(getByText('Basic').props.className).toContain('font-semibold');
  });

  it('persists a changed review mode and interval choice for the user', () => {
    const { getByText } = render(<Settings />);
    fireEvent.press(getByText('Extended'));
    fireEvent.press(getByText('Show'));
    expect(loadReviewPreferences('user-settings')).toEqual({
      reviewMode: 'extended',
      showNextReviewInterval: true,
    });
    expect(getByText('Extended').props.className).toContain('font-semibold');
  });
});
