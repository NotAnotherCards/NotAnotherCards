import { render, screen } from "@testing-library/react";
import { App, router } from "../App";
import userEvent from "@testing-library/user-event";
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

// Verify that navigating to the /app subdirectory loads the text from route.tsx(app) alongside nested pages like dashboard
describe("App Layout Guards", () => {
  beforeEach(async () => {
    // Reset router history and path
    window.history.pushState(null, "", "/");
    await router.navigate({ to: "/" });

    // Mock logged-in state
    vi.mocked(authClient.getSession).mockResolvedValue({ data: mockSession, error: null });
    vi.mocked(authClient.useSession).mockReturnValue({
      data: mockSession,
      isPending: false,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof authClient.useSession>);

    // Invalidate router cache to ensure loaders re-run with the new mock values
    await router.invalidate();
    await router.preloadRoute({ to: "/app/dashboard" });
  });

  it("renders the protection wrapper on the dashboard page", async () => {
    const user = userEvent.setup();
    render(<App />);
    // Navigate to dashboard
    const dashboardLink = await screen.findByRole("link", {
      name: /dashboard/i,
    });
    await user.click(dashboardLink);
    // Verify the protected layout message is rendered
    expect(
      await screen.findByText(/everything here will be protected/i),
    ).toBeInTheDocument();
    // Verify the dashboard route component is also rendered inside it
    expect(
      screen.getByRole("heading", { name: /DASHBOARD PAGE/i }),
    ).toBeInTheDocument();
  });
});
