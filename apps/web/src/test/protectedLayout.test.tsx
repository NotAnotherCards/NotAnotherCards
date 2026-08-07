import { render, screen, act } from "@testing-library/react";
import { App, router } from "../App";
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
    email: "user@example.com",
    name: "John Doe",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

// Verify that navigating to the /app subdirectory loads the text from route.tsx(app) alongside nested pages like dashboard
describe("App Layout Guards", () => {
  beforeEach(async () => {
    localStorage.setItem("nativeLanguage", "en");
    localStorage.setItem("preferedLanguage", "es");

    // Reset router history and path directly to the dashboard
    window.history.pushState(null, "", "/app/dashboard");
    await act(async () => {
      await router.navigate({ to: "/app/dashboard" });
    });

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

    // Invalidate router cache to ensure loaders re-run with the new mock values
    await act(async () => {
      await router.invalidate();
    });
  });

  afterEach(() => {
    localStorage.removeItem("nativeLanguage");
    localStorage.removeItem("preferedLanguage");
  });

  it("renders the protection wrapper on the dashboard page", async () => {
    render(<App />);
    // Verify the dashboard route component is rendered inside it
    expect(
      await screen.findByRole("heading", { name: /DASHBOARD PAGE/i }),
    ).toBeInTheDocument();
  });
});
