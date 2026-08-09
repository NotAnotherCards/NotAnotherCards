import { render, screen, act } from "@testing-library/react";
import { App, router } from "../App";
import { authClient } from "@/lib/auth-client";
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
    email: "user@example.com",
    name: "John Doe",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

vi.mock("@/offline/db", () => ({
  manager: {
    init: vi.fn().mockResolvedValue(undefined),
    state: { status: "ready" },
  },
}));

vi.mock("@remelondb/core/react", () => ({
  useDatabaseState: () => ({ status: "ready", error: null }),
  useQuery: () => ({ data: [], isLoading: false, error: null }),
}));

describe("Auth Guards", () => {
  beforeEach(async () => {
    // Reset router history and path
    window.history.pushState(null, "", "/");
  });

  it("redirects logged-out users from dashboard to login", async () => {
    // Mock logged-out state
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

    render(<App />);

    // Try to navigate to dashboard
    await act(async () => {
      await router.navigate({ to: "/app/dashboard" });
    });

    // Verify user is redirected to the login page
    expect(
      await screen.findByRole("heading", { name: /Welcome Back/i }),
    ).toBeInTheDocument();

    // Verify the URL is updated to /login
    expect(window.location.pathname).toBe("/login");
  }, 15000);

  it("allows logged-in users to see the dashboard", async () => {
    localStorage.setItem("nativeLanguage", "en");
    localStorage.setItem("preferedLanguage", "es");

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

    render(<App />);

    // Navigate to dashboard
    await act(async () => {
      await router.navigate({ to: "/app/dashboard" });
    });

    // Verify the dashboard route component is rendered
    expect(
      await screen.findByRole("heading", { name: /DASHBOARD PAGE/i }),
    ).toBeInTheDocument();

    // Verify welcome message with user name
    expect(screen.getByText(/Welcome/i)).toBeInTheDocument();
    expect(screen.getByText(/John Doe/i)).toBeInTheDocument();

    // Verify the URL is /app/dashboard
    expect(window.location.pathname).toBe("/app/dashboard");

    localStorage.removeItem("nativeLanguage");
    localStorage.removeItem("preferedLanguage");
  });
  }, 15000);

  it("redirects logged-in users away from the login page to the dashboard", async () => {
    localStorage.setItem("nativeLanguage", "en");
    localStorage.setItem("preferedLanguage", "es");

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

    render(<App />);

    // Try to navigate to login page
    await act(async () => {
      await router.navigate({ to: "/login" });
    });

    // Verify user is redirected to dashboard
    expect(
      await screen.findByRole("heading", { name: /DASHBOARD PAGE/i }),
    ).toBeInTheDocument();

    // Verify the URL is updated to /app/dashboard
    expect(window.location.pathname).toBe("/app/dashboard");

    localStorage.removeItem("nativeLanguage");
    localStorage.removeItem("preferedLanguage");
  });

  it("redirects logged-out users from onboarding to home", async () => {
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

    await act(async () => {
      await router.invalidate();
    });

    render(<App />);

    await act(async () => {
      await router.navigate({ to: "/app/onboarding" });
    });

    expect(window.location.pathname).toBe("/");
  });

  it("redirects logged-in users with setup settings from onboarding to dashboard", async () => {
    localStorage.setItem("nativeLanguage", "en");
    localStorage.setItem("preferedLanguage", "es");

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

    await act(async () => {
      await router.invalidate();
    });

    render(<App />);

    await act(async () => {
      await router.navigate({ to: "/app/onboarding" });
    });

    expect(window.location.pathname).toBe("/app/dashboard");

    localStorage.removeItem("nativeLanguage");
    localStorage.removeItem("preferedLanguage");
  });

  it("allows logged-in users without settings to see the onboarding page", async () => {
    localStorage.removeItem("nativeLanguage");
    localStorage.removeItem("preferedLanguage");

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

    await act(async () => {
      await router.invalidate();
    });

    render(<App />);

    await act(async () => {
      await router.navigate({ to: "/app/onboarding" });
    });

    expect(
      await screen.findByRole("heading", { name: /Welcome!/i }),
    ).toBeInTheDocument();

    expect(window.location.pathname).toBe("/app/onboarding");
  });

  it("redirects logged-in users without settings from dashboard to onboarding", async () => {
    localStorage.removeItem("nativeLanguage");
    localStorage.removeItem("preferedLanguage");

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

    await act(async () => {
      await router.invalidate();
    });

    render(<App />);

    await act(async () => {
      await router.navigate({ to: "/app/dashboard" });
    });

    expect(window.location.pathname).toBe("/app/onboarding");
  });

  it("allows logged-in users without settings to view the home page", async () => {
    localStorage.removeItem("nativeLanguage");
    localStorage.removeItem("preferedLanguage");

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

    await act(async () => {
      await router.invalidate();
    });

    render(<App />);

    await act(async () => {
      await router.navigate({ to: "/" });
    });

    expect(window.location.pathname).toBe("/");
  });

  it("redirects logged-out users from /app to home", async () => {
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

    await act(async () => {
      await router.invalidate();
    });

    render(<App />);

    await act(async () => {
      await router.navigate({ to: "/app" });
    });

    expect(window.location.pathname).toBe("/");
  });

  it("redirects logged-in users with setup settings from /app to dashboard", async () => {
    localStorage.setItem("nativeLanguage", "en");
    localStorage.setItem("preferedLanguage", "es");

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

    // Set path and navigate before rendering the app
    window.history.pushState(null, "", "/app");
    await act(async () => {
      await router.navigate({ to: "/app" });
    });

    render(<App />);

    expect(window.location.pathname).toBe("/app/dashboard");

    localStorage.removeItem("nativeLanguage");
    localStorage.removeItem("preferedLanguage");
  });

  it("signs out and allows access to login page for logged-in users without settings", async () => {
    localStorage.removeItem("nativeLanguage");
    localStorage.removeItem("preferedLanguage");

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

    await act(async () => {
      await router.invalidate();
    });

    render(<App />);

    await act(async () => {
      await router.navigate({ to: "/login" });
    });

    expect(authClient.signOut).toHaveBeenCalled();
});
