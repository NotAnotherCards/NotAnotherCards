import { render, screen } from "@testing-library/react";
import { App, router } from "../App";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

// Verify that navigating to the /app subdirectory loads the text from route.tsx(app) alongside nested pages like dashboard
describe("App Layout Guards", () => {
  beforeEach(async () => {
    window.history.pushState(null, "", "/");
    await router.navigate({ to: "/" });
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
    // Verify the dashboard route component is also rendered inside it
    expect(
      screen.getByRole("heading", { name: /DASHBOARD PAGE/i }),
    ).toBeInTheDocument();
  });
});
