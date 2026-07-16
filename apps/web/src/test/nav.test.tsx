import { render, screen } from "@testing-library/react";
import { App, router } from "../App";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

// Verify that routing and page transitions work correctly
describe("App Navigation", () => {
  beforeEach(async () => {
    window.history.pushState(null, "", "/");
    await router.navigate({ to: "/" });
    await router.preloadRoute({ to: "/login" });
    await router.preloadRoute({ to: "/register" });
  });

  it("navigates to the login page when clicking the Login link", async () => {
    const user = userEvent.setup();
    render(<App />);
    // Click the Login link in the header
    const loginLink = await screen.findByRole("link", { name: /^login$/i });
    await user.click(loginLink);
    // Verify the Login page contents are shown
    expect(
      await screen.findByRole("heading", { name: /Welcome Back/i }),
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
      await screen.findByRole("heading", { name: /Create Account/i }),
    ).toBeInTheDocument();
  });
});
