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
    
    // Check error text is visible
    expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
  });

  it("renders multiple error messages correctly", () => {
    const messages = ["Password must include a number", "Email is invalid"];
    render(<FormErrorMessage message={messages} />);

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();

    // Verify all error texts are visible
    expect(screen.getByText("Password must include a number")).toBeInTheDocument();
    expect(screen.getByText("Email is invalid")).toBeInTheDocument();
  });
});
