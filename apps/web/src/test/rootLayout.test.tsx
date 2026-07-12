import { render, screen } from "@testing-library/react";
import { App } from "../App";

// Verify that the global RootComponent renders the header, title, and all expected navigation options correctly on load.

describe("Root Layout", () => {
  it("renders the main brand name and navigation links in the header", async () => {
    render(<App />);
    // Check brand name link exists
    expect(
      await screen.findByRole("link", { name: /NotAnotherCards/i }),
    ).toBeInTheDocument();
    // Check all main links exist
    expect(screen.getByRole("link", { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /login/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /register/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
  });
});
