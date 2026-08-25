import { render, screen, act } from '@testing-library/react';
import { App, router } from '../App';
import userEvent from '@testing-library/user-event';
import { authClient } from '@/lib/auth-client';
import { useStore } from '@/hooks/useStore';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSession = {
  session: {
    id: 'session-123',
    userId: 'user-123',
    expiresAt: new Date(Date.now() + 3600000),
    token: 'token-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  user: {
    id: 'user-123',
    email: 'john.doe@example.com',
    name: 'John Doe',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    onBoardingComplete: false,
  },
};

const mockSessionOnboarded = {
  ...mockSession,
  user: {
    ...mockSession.user,
    onBoardingComplete: true,
  },
};

vi.mock('@/hooks/useStore', () => ({
  useStore: vi.fn(),
}));

vi.mock('@remelondb/core/react', () => ({
  useDatabaseState: () => ({ status: 'ready', error: null }),
  useQuery: () => ({ data: [], isLoading: false, error: null }),
  useDatabase: () => null,
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('Onboarding Flow and Guard Specs', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(useStore).mockReset();

    // Default useStore mock returning base values
    vi.mocked(useStore).mockReturnValue({
      createUserProfile: vi.fn().mockResolvedValue(undefined),
      updateUserProfile: vi.fn().mockResolvedValue(undefined),
      profile: null,
      decks: [],
      cards: [],
      dueCards: [],
      getCardsCount: () => 0,
    } as unknown as ReturnType<typeof useStore>);

    // Default logged-in session mocks (not onboarded)
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: mockSession,
      error: null,
    });
    vi.mocked(authClient.useSession).mockReturnValue({
      data: mockSession,
      isPending: false,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof authClient.useSession>);

    // Mock global fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    // Reset global router state synchronously to /onboarding to avoid test pollution
    window.history.pushState(null, '', '/onboarding');
    router.history.push('/onboarding');
    void router.invalidate();
  });

  it('redirects logged-in users to onboarding if onboarding is incomplete', async () => {
    // Render and wait for onboarding page to be ready
    render(<App />);
    expect(
      await screen.findByText(
        /Choose your username and language preferences/i,
        {},
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();

    // Attempt to navigate to dashboard
    await act(async () => {
      void router.navigate({ to: '/app/dashboard' });
    });

    // Should redirect back to onboarding and render the onboarding page elements
    expect(
      await screen.findByText(
        /Choose your username and language preferences/i,
        {},
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/onboarding');
  });

  it('redirects logged-in users to dashboard if onboarding is complete', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: mockSessionOnboarded,
      error: null,
    });
    vi.mocked(authClient.useSession).mockReturnValue({
      data: mockSessionOnboarded,
      isPending: false,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof authClient.useSession>);

    void router.invalidate();

    // Render - since onboarding is complete, it will redirect immediately to dashboard
    render(<App />);
    expect(
      await screen.findByRole(
        'heading',
        { name: /DASHBOARD PAGE/i },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();

    // Attempt to navigate to onboarding
    await act(async () => {
      void router.navigate({ to: '/onboarding' });
    });

    // Should redirect back to dashboard
    expect(
      await screen.findByRole(
        'heading',
        { name: /DASHBOARD PAGE/i },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/app/dashboard');
  });

  it('displays validation errors for invalid or empty fields', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Find submit button on onboarding page
    const submitBtn = await screen.findByRole(
      'button',
      { name: /Complete Registration/i },
      { timeout: 5000 },
    );
    await user.click(submitBtn);

    // Verify validation errors are shown
    expect(
      await screen.findByText(
        'Username must be at least 3 characters',
        {},
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Native language is required'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Target language is required'),
    ).toBeInTheDocument();
  });

  it('submits the form successfully and calls the onboarding API endpoint', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Fill in the form
    const usernameInput = await screen.findByLabelText(
      /Username/i,
      {},
      { timeout: 5000 },
    );
    await user.type(usernameInput, 'alex_test');

    const nativeSelect = screen.getByLabelText(/Native Language/i);
    await user.selectOptions(
      nativeSelect,
      '00000000-0000-0000-0000-000000000001',
    ); // English

    const targetSelect = screen.getByLabelText(/Target Language/i);
    await user.selectOptions(
      targetSelect,
      '00000000-0000-0000-0000-000000000002',
    ); // Spanish

    // Submit (flip guard state to true by updating the session mock so dashboard redirection completes successfully)
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: mockSessionOnboarded,
      error: null,
    });
    vi.mocked(authClient.useSession).mockReturnValue({
      data: mockSessionOnboarded,
      isPending: false,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof authClient.useSession>);

    const submitBtn = screen.getByRole('button', {
      name: /Complete Registration/i,
    });
    await user.click(submitBtn);

    // Verify fetch was called with correct endpoint and payload
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/onboard',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          username: 'alex_test',
          native_language_id: '00000000-0000-0000-0000-000000000001',
          target_language_id: '00000000-0000-0000-0000-000000000002',
        }),
      }),
    );

    // Verify redirection to dashboard occurred after success
    expect(
      await screen.findByRole(
        'heading',
        { name: /DASHBOARD PAGE/i },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/app/dashboard');
  });

  it("checks username availability on blur and displays validation error if taken", async () => {
    // Mock fetch for username availability check to return available: false
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/auth/check-username")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ available: false }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);
    });

    const user = userEvent.setup();
    render(<App />);

    // Type a username
    const usernameInput = await screen.findByLabelText(/Username/i, {}, { timeout: 5000 });
    await user.type(usernameInput, "taken_user");

    // Trigger blur by tabbing away
    await user.tab();

    // Verify availability check API was called
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/check-username?username=taken_user");

    // Verify validation error is displayed
    expect(await screen.findByText("Username is already taken")).toBeInTheDocument();
  });
});
