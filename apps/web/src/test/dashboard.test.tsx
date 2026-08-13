import { render, screen, act } from "@testing-library/react";
import { App, router } from "../App";
import userEvent from "@testing-library/user-event";
import { authClient } from "@/lib/auth-client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/offline/db", () => {
  const manager = {
    init: vi.fn().mockResolvedValue(undefined),
    state: { status: "ready" },
  };
  return {
    manager,
    createUserDatabaseManager: vi.fn(() => manager),
    closeUserDatabase: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@remelondb/core/react", () => ({
  useDatabaseState: () => ({ status: "ready", error: null }),
  useQuery: () => ({ data: [], isLoading: false, error: null }),
  useDatabase: () => null,
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe("Dashboard Page Component Specs", () => {
  beforeEach(async () => {
    // Reset router history and path directly to the dashboard
    window.history.pushState(null, "", "/app/dashboard");

    // Mock logged-in state
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
  });

  afterEach(() => {
  });

  it("renders welcome text, user email/name, and placeholder feature sections", async () => {
    render(<App />);
    await act(async () => {
      await router.navigate({ to: "/app/dashboard" });
    });

    // 1. Dashboard renders welcome text
    expect(
      await screen.findByText(/Welcome to your language learning portal/i),
    ).toBeInTheDocument();

    // 2. Dashboard shows user email/name
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("john.doe@example.com")).toBeInTheDocument();

    // 3. Dashboard has placeholder sections for future features
    expect(screen.getByText("Explore Dictionaries")).toBeInTheDocument();
    expect(screen.getByText("Daily Learning Goals")).toBeInTheDocument();
    expect(screen.getByText("Today's Reviews")).toBeInTheDocument();
    expect(screen.getByText("Personal Dictionary")).toBeInTheDocument();
  });

  it("calls signOut and redirects the user to the login page on logout click", async () => {
    // Mock signOut implementation to clear logged-in mocks on call
    vi.mocked(authClient.signOut).mockImplementation(async () => {
      vi.mocked(authClient.getSession).mockResolvedValue({
        data: null,
        error: null,
      });
      vi.mocked(authClient.useSession).mockReturnValue({
        data: null,
        isPending: false,
        isRefetching: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof authClient.useSession>);
      return { data: null, error: null };
    });

    const user = userEvent.setup();
    render(<App />);
    await act(async () => {
      await router.navigate({ to: "/app/dashboard" });
    });

    // Find the logout button
    const logoutButton = await screen.findByRole("button", {
      name: /logout/i,
    });

    // Click the logout button
    await user.click(logoutButton);

    // Verify signOut was called
    expect(authClient.signOut).toHaveBeenCalled();

    // Verify user is redirected to the login page
    expect(
      await screen.findByRole("heading", { name: /Welcome Back/i }),
    ).toBeInTheDocument();
  });
});
