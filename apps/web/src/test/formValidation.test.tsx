import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginComponent } from "../components/auth/login-form";
import { RegisterComponent } from "../components/auth/register-form";

// Mock @tanstack/react-router Link and useNavigate since they require a Router context
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  createFileRoute: () => () => ({
    component: () => null,
  }),
  useNavigate: () => vi.fn(),
}));

const expectErrorToShow = async (text: string) => {
  const elements = await screen.findAllByText(text);
  expect(elements.length).toBeGreaterThan(0);
  expect(elements[0]).toBeInTheDocument();
};

describe("Login Form Validation", () => {
  it("shows validation error messages when fields are invalid", async () => {
    const user = userEvent.setup();
    render(<LoginComponent />);

    const submitButton = screen.getByRole("button", { name: /Login/i });

    // Submit with empty fields to trigger validation
    await user.click(submitButton);

    // Verify error messages
    await expectErrorToShow("Please enter a valid email address");
    await expectErrorToShow("Password is required");

    // Type invalid email and submit
    const emailInput = screen.getByLabelText(/Email/i);
    await user.type(emailInput, "not-an-email");
    await user.click(submitButton);

    await expectErrorToShow("Please enter a valid email address");
  });
});

describe("Register Form Validation", () => {
  it("shows validation error messages when fields are invalid", async () => {
    const user = userEvent.setup();
    render(<RegisterComponent />);

    const submitButton = screen.getByRole("button", { name: /Sign up/i });

    // Submit empty form
    await user.click(submitButton);

    // Verify general required field validations
    await expectErrorToShow("Name must be at least 2 characters");
    await expectErrorToShow("Please enter a valid email address");
    await expectErrorToShow("Password must be at least 8 characters");
    await expectErrorToShow("Please confirm your password");

    // Type valid basic details but mismatching passwords
    const nameInput = screen.getByLabelText(/Name/i);
    const emailInput = screen.getByLabelText(/Email/i);
    const passwordInput = screen.getByLabelText(/^Password$/i);
    const confirmPasswordInput = screen.getByLabelText(/Confirm Password/i);

    await user.type(nameInput, "John Doe");
    await user.type(emailInput, "john.doe@example.com");
    await user.type(passwordInput, "Password123!");
    await user.type(confirmPasswordInput, "Different123!");

    await user.click(submitButton);

    // Verify mismatching password error message
    await expectErrorToShow("Passwords do not match");
  });

  it("shows specific password constraint messages", async () => {
    const user = userEvent.setup();
    render(<RegisterComponent />);

    const passwordInput = screen.getByLabelText(/^Password$/i);
    const submitButton = screen.getByRole("button", { name: /Sign up/i });

    // 1. Password too short
    await user.type(passwordInput, "123");
    await user.click(submitButton);
    await expectErrorToShow("Password must be at least 8 characters");

    // 2. Missing uppercase
    await user.clear(passwordInput);
    await user.type(passwordInput, "abcdefg1!");
    await user.click(submitButton);
    await expectErrorToShow("Password must include an uppercase letter");

    // 3. Missing lowercase
    await user.clear(passwordInput);
    await user.type(passwordInput, "ABCDEFG1!");
    await user.click(submitButton);
    await expectErrorToShow("Password must include a lowercase letter");

    // 4. Missing number
    await user.clear(passwordInput);
    await user.type(passwordInput, "Abcdefgh!");
    await user.click(submitButton);
    await expectErrorToShow("Password must include a number");

    // 5. Missing special character
    await user.clear(passwordInput);
    await user.type(passwordInput, "Abcdefg1");
    await user.click(submitButton);
    await expectErrorToShow("Password must include a special character");
  });
});
