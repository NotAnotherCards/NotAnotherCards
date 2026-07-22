import { render, screen } from "@testing-library/react";
import { FormErrorMessage } from "../components/auth/form-error-message";
import { describe, expect, it } from "vitest";

describe("FormErrorMessage Component", () => {
  it("renders nothing when message is empty or null", () => {
    const { container } = render(<FormErrorMessage message={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a single error message correctly with accessibility attributes", () => {
    render(<FormErrorMessage message="Invalid credentials" />);

    // Check that container has alert role for screen readers
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute("aria-live", "assertive");

    // Check error text is visible and rendered inside a paragraph element
    const errorText = screen.getByText("Invalid credentials");
    expect(errorText).toBeInTheDocument();
    expect(errorText.tagName).toBe("P");

    // Verify no list structure is used
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("renders multiple error messages correctly", () => {
    const messages = ["Password must include a number", "Email is invalid"];
    render(<FormErrorMessage message={messages} />);

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();

    // Verify all error texts are visible
    expect(
      screen.getByText("Password must include a number"),
    ).toBeInTheDocument();
    expect(screen.getByText("Email is invalid")).toBeInTheDocument();

    // Verify list structure is used for multiple messages
    const list = screen.getByRole("list");
    expect(list).toBeInTheDocument();

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
  });
});
