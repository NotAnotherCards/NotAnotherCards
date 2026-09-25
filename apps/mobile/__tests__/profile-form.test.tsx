import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { UserProfileRecord } from '@repo/offline-db';
import { ProfileForm } from '@/components/profile-form';

const mockCheckUsername = jest.fn<Promise<boolean>, [string]>();
jest.mock('../lib/profile', () => ({
  checkUsernameAvailable: (username: string) => mockCheckUsername(username),
}));
jest.mock('../components/ui/icon', () => ({
  GlobeIcon: () => null,
  UserIcon: () => null,
}));

const profile = {
  id: 'p1',
  username: 'jane',
  native_language_id: '00000000-0000-0000-0000-000000000003',
  target_language_id: '00000000-0000-0000-0000-000000000002',
} as unknown as UserProfileRecord;

// Leaving the username field is what saves it; a language saves on tap.
const leaveUsername = async (screen: ReturnType<typeof render>) => {
  fireEvent(screen.getByLabelText('Username'), 'endEditing');
  await act(async () => {});
};

const tapLanguage = async (
  screen: ReturnType<typeof render>,
  label: RegExp,
) => {
  fireEvent.press(screen.getByLabelText(label));
  await act(async () => {});
};

describe('ProfileForm', () => {
  beforeEach(() => {
    mockCheckUsername.mockReset();
    mockCheckUsername.mockResolvedValue(true);
  });

  it('prefills the stored profile', () => {
    const { getByDisplayValue, getByLabelText } = render(
      <ProfileForm profile={profile} onSave={jest.fn()} />,
    );
    expect(getByDisplayValue('jane')).toBeTruthy();
    expect(
      getByLabelText(/Native language: .*German/).props.accessibilityState
        .selected,
    ).toBe(true);
  });

  it('saves nothing while the username is being typed', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const screen = render(<ProfileForm profile={profile} onSave={onSave} />);
    fireEvent.changeText(screen.getByDisplayValue('jane'), 'jane-doe');
    await act(async () => {});

    expect(mockCheckUsername).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('refuses an invalid username and a missing language, and saves neither', async () => {
    const onSave = jest.fn();
    const screen = render(<ProfileForm profile={profile} onSave={onSave} />);
    fireEvent.changeText(screen.getByDisplayValue('jane'), 'ab');
    await leaveUsername(screen);

    expect(
      screen.getByText('Username must be at least 3 characters'),
    ).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();

    // Picking the target language as native empties the target, so the
    // form is incomplete and must not be written either.
    await tapLanguage(screen, /Native language: .*Spanish/);
    expect(screen.getByText('Target language is required')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('checks a changed username and saves through onSave', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const screen = render(<ProfileForm profile={profile} onSave={onSave} />);
    fireEvent.changeText(screen.getByDisplayValue('jane'), 'jane-doe');
    await leaveUsername(screen);

    expect(mockCheckUsername).toHaveBeenCalledWith('jane-doe');
    expect(onSave).toHaveBeenCalledWith({
      username: 'jane-doe',
      native_language_id: '00000000-0000-0000-0000-000000000003',
      target_language_id: '00000000-0000-0000-0000-000000000002',
    });
    expect(screen.getByText('Saved')).toBeTruthy();
  });

  it('keeps the entered values and shows why when the username is taken', async () => {
    mockCheckUsername.mockResolvedValue(false);
    const onSave = jest.fn();
    const screen = render(<ProfileForm profile={profile} onSave={onSave} />);
    fireEvent.changeText(screen.getByDisplayValue('jane'), 'taken');
    await leaveUsername(screen);

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Username is already taken')).toBeTruthy();
    expect(screen.getByDisplayValue('taken')).toBeTruthy();
  });

  it('saves a language on tap without checking the username, and reports a failed save', async () => {
    const onSave = jest.fn().mockRejectedValue(new Error('The write failed'));
    const screen = render(<ProfileForm profile={profile} onSave={onSave} />);
    await tapLanguage(screen, /Target language: .*Russian/);

    expect(mockCheckUsername).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalled();
    expect(screen.getByText('The write failed')).toBeTruthy();
  });

  it('lets the newest save win when an older one is still in flight', async () => {
    // Each check gets its own promise, and they resolve out of order: the
    // language tapped second finishes first, so the older save must not
    // write its stale languages afterwards.
    const releases: (() => void)[] = [];
    mockCheckUsername.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          releases.push(() => resolve(true));
        }),
    );
    const onSave = jest.fn().mockResolvedValue(undefined);
    const screen = render(<ProfileForm profile={profile} onSave={onSave} />);

    fireEvent.changeText(screen.getByDisplayValue('jane'), 'jane-doe');
    fireEvent(screen.getByLabelText('Username'), 'endEditing');
    await act(async () => {});
    fireEvent.press(screen.getByLabelText(/Target language: .*Russian/));
    await act(async () => {});

    releases[1]?.();
    await act(async () => {});
    releases[0]?.();
    await act(async () => {});

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        target_language_id: '00000000-0000-0000-0000-000000000004',
      }),
    );
  });

  it('keeps a saved value when the profile prop is still the old one', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const screen = render(<ProfileForm profile={profile} onSave={onSave} />);
    fireEvent.changeText(screen.getByDisplayValue('jane'), 'jane-doe');
    await leaveUsername(screen);

    // The parent's live query has not caught up yet.
    screen.rerender(<ProfileForm profile={profile} onSave={onSave} />);
    expect(screen.getByDisplayValue('jane-doe')).toBeTruthy();
  });

  it('saves a username draft when the form goes away', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const screen = render(<ProfileForm profile={profile} onSave={onSave} />);
    fireEvent.changeText(screen.getByDisplayValue('jane'), 'jane-doe');

    // Switching sub-tab unmounts the field without an endEditing event.
    screen.unmount();
    await act(async () => {});

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'jane-doe' }),
    );
  });

  it('takes a profile that arrives later only while the form is untouched', () => {
    const screen = render(<ProfileForm profile={null} onSave={jest.fn()} />);
    screen.rerender(<ProfileForm profile={profile} onSave={jest.fn()} />);
    expect(screen.getByDisplayValue('jane')).toBeTruthy();

    fireEvent.changeText(screen.getByDisplayValue('jane'), 'typing');
    screen.rerender(
      <ProfileForm
        profile={{ ...profile, username: 'synced' } as UserProfileRecord}
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByDisplayValue('typing')).toBeTruthy();
  });
});
