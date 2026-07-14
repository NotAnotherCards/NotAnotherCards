import { render, screen } from "@testing-library/react";
import { App } from "../App";
import userEvent from "@testing-library/user-event";

// Verify that routing and page transitions work correctly
describe("App Navigation", () => {
  it("navigates to the login page when clicking the Login link", async () => {
    const user = userEvent.setup();
    render(<App />);
    // Click the Login link in the header
    const loginLink = await screen.findByRole("link", { name: /^login$/i });
    await user.click(loginLink);
    // Verify the Login page contents are shown
    expect(
      await screen.findByRole("heading", { name: /LOGIN PAGE/i }),
    ).toBeInTheDocument();
  });
  it("navigates to the register page when clicking the Register link", async () => {
    const user = userEvent.setup();
    render(<App />);
    // Click the Register link in the header
    const registerLink = await screen.findByRole("link", {
      name: /^register$/i,
    });
    await user.click(registerLink);
    // Verify the Registration page contents are shown
    expect(
      await screen.findByRole("heading", { name: /REGISTRATION PAGE/i }),
    ).toBeInTheDocument();
  });
});
