import React from 'react';
import { act, render, fireEvent, waitFor } from '@testing-library/react-native';
import Onboarding from '@/app/onboarding';

const mockReplace = jest.fn();

// expo-router isn't available in the test env; stub the pieces the screen uses.
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockCompleteOnboarding = jest.fn(
  async (_values: unknown): Promise<void> => undefined,
);
jest.mock('../lib/onboarding', () => ({
  completeOnboarding: (values: unknown) => mockCompleteOnboarding(values),
}));

// What useSession returns; tests mutate this to simulate the refreshed
// session arriving after refetch.
let mockSession: {
  data: { user: { onBoardingComplete: boolean } } | null;
  isPending: boolean;
};
const mockRefetch = jest.fn();

jest.mock('../lib/auth-client', () => ({
  authClient: {
    useSession: () => ({ ...mockSession, refetch: mockRefetch }),
  },
}));

async function fillAndSubmit(screen: ReturnType<typeof render>) {
  fireEvent.changeText(
    screen.getByPlaceholderText('your-username'),
    'jane-doe',
  );
  fireEvent.press(screen.getByLabelText(/Native language: .*German/));
  fireEvent.press(screen.getByLabelText(/Target language: .*Spanish/));
  fireEvent.press(screen.getByText('Complete setup'));
  await act(async () => {});
}

beforeEach(() => {
  mockSession = {
    data: { user: { onBoardingComplete: false } },
    isPending: false,
  };
  mockReplace.mockClear();
  mockRefetch.mockClear();
  mockCompleteOnboarding.mockClear();
  mockCompleteOnboarding.mockResolvedValue(undefined);
});

describe('Onboarding screen', () => {
  it('submits, refetches, and navigates only once the flag flips', async () => {
    const screen = render(<Onboarding />);
    await fillAndSubmit(screen);

    await waitFor(() => expect(mockCompleteOnboarding).toHaveBeenCalled());
    expect(mockRefetch).toHaveBeenCalled();
    // The request succeeded but the session store hasn't caught up yet.
    expect(mockReplace).not.toHaveBeenCalled();

    mockSession = {
      data: { user: { onBoardingComplete: true } },
      isPending: false,
    };
    screen.rerender(<Onboarding />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows the server message and keeps values on a conflict', async () => {
    mockCompleteOnboarding.mockRejectedValue(
      new Error('Username already taken'),
    );
    const screen = render(<Onboarding />);
    await fillAndSubmit(screen);

    await waitFor(() => screen.getByText('Username already taken'));
    expect(mockReplace).not.toHaveBeenCalled();
    // Entered values survive the failed submit.
    expect(screen.getByDisplayValue('jane-doe')).toBeTruthy();
  });

  it('redirects immediately when onboarding is already complete', async () => {
    mockSession = {
      data: { user: { onBoardingComplete: true } },
      isPending: false,
    };
    render(<Onboarding />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/dashboard'));
    expect(mockCompleteOnboarding).not.toHaveBeenCalled();
  });
});
