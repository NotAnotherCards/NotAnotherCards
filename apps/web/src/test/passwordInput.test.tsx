import { render, screen } from "@testing-library/react";
import { PasswordInput } from "../components/ui/password-input";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

describe("PasswordInput Component", () => {
  it("successfully toggles between type=\"password\" and type=\"text\"", async () => {
    const user = userEvent.setup();
    render(<PasswordInput placeholder="Enter password" />);

    // Find the input and verify it has type="password" initially
    const input = screen.getByPlaceholderText("Enter password") as HTMLInputElement;
    expect(input.type).toBe("password");

    // Find the toggle button (by its initial aria-label)
    const toggleButton = screen.getByRole("button", { name: /show password/i });
    expect(toggleButton).toBeInTheDocument();

    // Click to show password
    await user.click(toggleButton);

    // Verify it changed to type="text"
    expect(input.type).toBe("text");
    
    // Verify the aria-label updated to "Hide password"
    expect(toggleButton).toHaveAttribute("aria-label", "Hide password");

    // Click to hide password
    await user.click(toggleButton);

    // Verify it changed back to type="password"
    expect(input.type).toBe("password");
    expect(toggleButton).toHaveAttribute("aria-label", "Show password");
  });
});
