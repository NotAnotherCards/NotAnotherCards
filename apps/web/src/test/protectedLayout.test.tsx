import { render, screen } from "@testing-library/react";
import { App } from "../App";
import userEvent from "@testing-library/user-event";

// Verify that navigating to the /app subdirectory loads the text from route.tsx(app) alongside nested pages like dashboard
describe("App Layout Guards", () => {
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
