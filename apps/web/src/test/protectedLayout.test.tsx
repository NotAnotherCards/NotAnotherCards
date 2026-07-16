import { render, screen, act } from "@testing-library/react";
import { App, router } from "../App";
import { authClient } from "@/lib/auth-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Verify that navigating to the /app subdirectory loads the text from route.tsx(app) alongside nested pages like dashboard
describe("App Layout Guards", () => {
  beforeEach(async () => {
    window.history.pushState(null, "", "/");
    await router.navigate({ to: "/" });
    router.invalidate();
  });

  it("renders the protection wrapper on the dashboard page", async () => {
    // Mock the user as logged in so the /app layout guard allows loading the dashboard
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: {
        session: {
          id: "session-id",
          userId: "user-id",
          expiresAt: new Date(),
          token: "token",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        user: {
          id: "user-id",
          name: "Test User",
          email: "test@example.com",
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      error: null,
    });

    vi.mocked(authClient.useSession).mockReturnValue({
      data: {
        session: {
          id: "session-id",
          userId: "user-id",
          expiresAt: new Date(),
          token: "token",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        user: {
          id: "user-id",
          name: "Test User",
          email: "test@example.com",
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      isPending: false,
      isRefetching: false,
      error: null,
      refetch: vi.fn() as any,
    });

    render(<App />);
    
    // Programmatically navigate to the dashboard (awaits the guard and page load)
    await act(async () => {
      await router.navigate({ to: "/app/dashboard" });
    });

    // Verify the dashboard route component is rendered inside it
    expect(
      screen.getByRole("heading", { name: /DASHBOARD PAGE/i }),
    ).toBeInTheDocument();
  });
});
