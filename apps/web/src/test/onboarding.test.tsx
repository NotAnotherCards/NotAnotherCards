import { render, screen, act } from "@testing-library/react";
import { App, router } from "../App";
import userEvent from "@testing-library/user-event";
import { authClient } from "@/lib/auth-client";
import { checkOnboardingComplete } from "@/offline/db";
import { useStore } from "@/hooks/useStore";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSession = {
  session: {
    id: "session-123",
    userId: "user-123",
    expiresAt: new Date(Date.now() + 3600000),
    token: "token-123",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  user: {
    id: "user-123",
    email: "john.doe@example.com",
    name: "John Doe",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

vi.mock("@/hooks/useStore", () => ({
  useStore: vi.fn(),
}));

vi.mock("@remelondb/core/react", () => ({
  useDatabaseState: () => ({ status: "ready", error: null }),
  useQuery: () => ({ data: [], isLoading: false, error: null }),
  useDatabase: () => null,
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe("Onboarding Flow and Guard Specs", () => {
  const mockCreateUserProfile = vi.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(checkOnboardingComplete).mockReset();
    vi.mocked(useStore).mockReset();

    // Default mock to false (onboarding incomplete) so the router reset evaluates correctly
    vi.mocked(checkOnboardingComplete).mockResolvedValue(false);

    // Default useStore mock returning base values
    vi.mocked(useStore).mockReturnValue({
      createUserProfile: mockCreateUserProfile,
      updateUserProfile: vi.fn().mockResolvedValue(undefined),
      profile: null,
      decks: [],
      cards: [],
      dueCards: [],
      getCardsCount: () => 0,
    });

    // Default logged-in session mocks
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

    // Reset global router state synchronously to /app/onboarding to avoid test pollution
    window.history.pushState(null, "", "/app/onboarding");
    router.history.push("/app/onboarding");
    router.invalidate();
  });

  it("redirects logged-in users to onboarding if onboarding is incomplete", async () => {
    // Render and wait for onboarding page to be ready
    render(<App />);
    expect(
      await screen.findByText(/Choose your username and language preferences/i, {}, { timeout: 5000 }),
    ).toBeInTheDocument();

    // Attempt to navigate to dashboard
    await act(async () => {
      void router.navigate({ to: "/app/dashboard" });
    });

    // Should redirect back to onboarding and render the onboarding page elements
    expect(
      await screen.findByText(/Choose your username and language preferences/i, {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/app/onboarding");
  });

  it("redirects logged-in users to dashboard if onboarding is complete", async () => {
    vi.mocked(checkOnboardingComplete).mockResolvedValue(true);
    router.invalidate();

    // Render - since onboarding is complete, it will redirect immediately to dashboard
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: /DASHBOARD PAGE/i }, { timeout: 5000 }),
    ).toBeInTheDocument();

    // Attempt to navigate to onboarding
    await act(async () => {
      void router.navigate({ to: "/app/onboarding" });
    });

    // Should redirect back to dashboard
    expect(
      await screen.findByRole("heading", { name: /DASHBOARD PAGE/i }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/app/dashboard");
  });

  it("displays validation errors for invalid or empty fields", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Find submit button on onboarding page
    const submitBtn = await screen.findByRole("button", { name: /Complete Registration/i }, { timeout: 5000 });
    await user.click(submitBtn);

    // Verify validation errors are shown
    expect(await screen.findByText("Username must be at least 3 characters", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(await screen.findByText("Native language is required")).toBeInTheDocument();
    expect(await screen.findByText("Target language is required")).toBeInTheDocument();
  });

  it("submits the form successfully and calls createUserProfile database action", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Fill in the form
    const usernameInput = await screen.findByLabelText(/Username/i, {}, { timeout: 5000 });
    await user.type(usernameInput, "alex_test");

    const nativeSelect = screen.getByLabelText(/Native Language/i);
    await user.selectOptions(nativeSelect, "00000000-0000-0000-0000-000000000001"); // English

    const targetSelect = screen.getByLabelText(/Target Language/i);
    await user.selectOptions(targetSelect, "00000000-0000-0000-0000-000000000002"); // Spanish

    // Submit (flip guard state to true so dashboard redirection completes successfully)
    vi.mocked(checkOnboardingComplete).mockResolvedValue(true);
    const submitBtn = screen.getByRole("button", { name: /Complete Registration/i });
    await user.click(submitBtn);

    // Verify createUserProfile database write was called with exact correct arguments
    expect(mockCreateUserProfile).toHaveBeenCalledWith({
      id: "user-123",
      username: "alex_test",
      native_language_id: "00000000-0000-0000-0000-000000000001",
      target_language_id: "00000000-0000-0000-0000-000000000002",
    });

    // Verify redirection to dashboard occurred after success
    expect(await screen.findByRole("heading", { name: /DASHBOARD PAGE/i }, { timeout: 5000 })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/app/dashboard");
  });
});
