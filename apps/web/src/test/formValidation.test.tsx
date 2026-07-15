import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginComponent } from "../components/auth/login-form";
import { RegisterComponent } from "../components/auth/register-form";

// Mock @tanstack/react-router Link since it requires a Router context
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  createFileRoute: () => () => ({
    component: () => null,
  }),
}));

describe("Login Form Validation", () => {
  it("shows validation error messages when fields are invalid", async () => {
    const user = userEvent.setup();
    render(<LoginComponent />);

    const submitButton = screen.getByRole("button", { name: /Login/i });

    // Submit with empty fields to trigger validation
    await user.click(submitButton);

    // Verify error messages
    expect(await screen.findByText("Please enter a valid email address")).toBeInTheDocument();
    expect(await screen.findByText("Password is required")).toBeInTheDocument();

    // Type invalid email and submit
    const emailInput = screen.getByLabelText(/Email/i);
    await user.type(emailInput, "not-an-email");
    await user.click(submitButton);

    expect(await screen.findByText("Please enter a valid email address")).toBeInTheDocument();
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
    expect(await screen.findByText("First name must be at least 2 characters")).toBeInTheDocument();
    expect(await screen.findByText("Last name must be at least 2 characters")).toBeInTheDocument();
    expect(await screen.findByText("Please enter a valid email address")).toBeInTheDocument();
    expect(await screen.findByText("Password must be at least 8 characters")).toBeInTheDocument();
    expect(await screen.findByText("Please confirm your password")).toBeInTheDocument();

    // Type valid basic details but mismatching passwords
    const firstNameInput = screen.getByLabelText(/First Name/i);
    const lastNameInput = screen.getByLabelText(/Last Name/i);
    const emailInput = screen.getByLabelText(/Email/i);
    const passwordInput = screen.getByLabelText(/^Password$/i);
    const confirmPasswordInput = screen.getByLabelText(/Confirm Password/i);

    await user.type(firstNameInput, "John");
    await user.type(lastNameInput, "Doe");
    await user.type(emailInput, "john.doe@example.com");
    await user.type(passwordInput, "Password123!");
    await user.type(confirmPasswordInput, "Different123!");

    await user.click(submitButton);

    // Verify mismatching password error message
    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
  });

  it("shows specific password constraint messages", async () => {
    const user = userEvent.setup();
    render(<RegisterComponent />);

    const passwordInput = screen.getByLabelText(/^Password$/i);
    const submitButton = screen.getByRole("button", { name: /Sign up/i });

    // 1. Password too short
    await user.type(passwordInput, "123");
    await user.click(submitButton);
    expect(await screen.findByText("Password must be at least 8 characters")).toBeInTheDocument();

    // 2. Missing uppercase
    await user.clear(passwordInput);
    await user.type(passwordInput, "abcdefg1!");
    await user.click(submitButton);
    expect(await screen.findByText("Password must include an uppercase letter")).toBeInTheDocument();

    // 3. Missing lowercase
    await user.clear(passwordInput);
    await user.type(passwordInput, "ABCDEFG1!");
    await user.click(submitButton);
    expect(await screen.findByText("Password must include a lowercase letter")).toBeInTheDocument();

    // 4. Missing number
    await user.clear(passwordInput);
    await user.type(passwordInput, "Abcdefgh!");
    await user.click(submitButton);
    expect(await screen.findByText("Password must include a number")).toBeInTheDocument();

    // 5. Missing special character
    await user.clear(passwordInput);
    await user.type(passwordInput, "Abcdefg1");
    await user.click(submitButton);
    expect(await screen.findByText("Password must include a special character")).toBeInTheDocument();
  });
});
