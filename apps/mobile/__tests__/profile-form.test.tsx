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

const submit = async (screen: ReturnType<typeof render>) => {
  fireEvent.press(screen.getByText('Save changes'));
  await act(async () => {});
};

describe('ProfileForm', () => {
  beforeEach(() => {
    mockCheckUsername.mockReset();
    mockCheckUsername.mockResolvedValue(true);
  });

  it('prefills the stored profile and disables Save until something changes', () => {
    const { getByDisplayValue, getByRole, getByLabelText } = render(
      <ProfileForm profile={profile} onSave={jest.fn()} />,
    );
    expect(getByDisplayValue('jane')).toBeTruthy();
    expect(
      getByLabelText(/Native language: .*German/).props.accessibilityState
        .selected,
    ).toBe(true);
    expect(
      getByRole('button', { name: 'Save changes' }).props.accessibilityState
        .disabled,
    ).toBe(true);
  });

  it('checks a changed username and saves through onSave', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const screen = render(<ProfileForm profile={profile} onSave={onSave} />);
    fireEvent.changeText(screen.getByDisplayValue('jane'), 'jane-doe');
    await submit(screen);

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
    await submit(screen);

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Username is already taken')).toBeTruthy();
    expect(screen.getByDisplayValue('taken')).toBeTruthy();
  });

  it('does not check the username when only a language changed, and reports a failed save', async () => {
    const onSave = jest.fn().mockRejectedValue(new Error('The write failed'));
    const screen = render(<ProfileForm profile={profile} onSave={onSave} />);
    fireEvent.press(screen.getByLabelText(/Target language: .*Russian/));
    await submit(screen);

    expect(mockCheckUsername).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalled();
    expect(screen.getByText('The write failed')).toBeTruthy();
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
