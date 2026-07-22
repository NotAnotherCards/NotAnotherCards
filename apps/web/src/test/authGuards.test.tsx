import { render, screen } from "@testing-library/react";
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

describe("Auth Guards", () => {
  beforeEach(async () => {
    // Reset router history and path
    window.history.pushState(null, "", "/");
    await router.navigate({ to: "/" });
  });

  it("redirects logged-out users from dashboard to login", async () => {
    // Mock logged-out state
    vi.mocked(authClient.getSession).mockResolvedValue({ data: null, error: null });
    vi.mocked(authClient.useSession).mockReturnValue({
      data: null,
      isPending: false,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof authClient.useSession>);

    await router.invalidate();

    render(<App />);

    // Try to navigate to dashboard
    await router.navigate({ to: "/app/dashboard" });

    // Verify user is redirected to the login page
    expect(
      await screen.findByRole("heading", { name: /Welcome Back/i }),
    ).toBeInTheDocument();
    
    // Verify the URL is updated to /login
    expect(window.location.pathname).toBe("/login");
  });

  it("allows logged-in users to see the dashboard", async () => {
    // Mock logged-in state
    vi.mocked(authClient.getSession).mockResolvedValue({ data: mockSession, error: null });
    vi.mocked(authClient.useSession).mockReturnValue({
      data: mockSession,
      isPending: false,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof authClient.useSession>);

    await router.invalidate();

    render(<App />);

    // Navigate to dashboard
    await router.navigate({ to: "/app/dashboard" });

    // Verify the dashboard route component is rendered
    expect(
      await screen.findByRole("heading", { name: /DASHBOARD PAGE/i }),
    ).toBeInTheDocument();
    
    // Verify welcome message with user name
    expect(screen.getByText(/Welcome/i)).toBeInTheDocument();
    expect(screen.getByText(/John Doe/i)).toBeInTheDocument();
    
    // Verify the URL is /app/dashboard
    expect(window.location.pathname).toBe("/app/dashboard");
  });

  it("redirects logged-in users away from the login page to the dashboard", async () => {
    // Mock logged-in state
    vi.mocked(authClient.getSession).mockResolvedValue({ data: mockSession, error: null });
    vi.mocked(authClient.useSession).mockReturnValue({
      data: mockSession,
      isPending: false,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof authClient.useSession>);

    await router.invalidate();

    render(<App />);

    // Try to navigate to login page
    await router.navigate({ to: "/login" });

    // Verify user is redirected to dashboard
    expect(
      await screen.findByRole("heading", { name: /DASHBOARD PAGE/i }),
    ).toBeInTheDocument();
    
    // Verify the URL is updated to /app/dashboard
    expect(window.location.pathname).toBe("/app/dashboard");
  });
});
