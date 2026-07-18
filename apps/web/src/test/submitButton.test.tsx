import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoginComponent } from "../components/auth/login-form";
import { RegisterComponent } from "../components/auth/register-form";
import { authClient } from "@/lib/auth-client";
import { act } from "react";

// Mock @tanstack/react-router Link and useNavigate since they require a Router context
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  createFileRoute: () => () => ({
    component: () => null,
  }),
  useNavigate: () => vi.fn(),
}));

describe("Submit Button Loading States", () => {
  it("LoginComponent submit button displays loading and disabled state while request is in-flight", async () => {
    const user = userEvent.setup();

    // Create a deferred promise to simulate a pending request
    let resolveRequest: (value: ReturnType<typeof authClient.signIn.email>) => void;
    const pendingPromise = new Promise<ReturnType<typeof authClient.signIn.email>>((resolve) => {
      resolveRequest = resolve;
    });

    // Mock the sign-in response to stay pending
    vi.mocked(authClient.signIn.email).mockImplementation(() => pendingPromise);

    render(<LoginComponent />);

    const emailInput = screen.getByLabelText(/Email/i);
    const passwordInput = screen.getByLabelText(/^Password$/i);
    const submitButton = screen.getByRole("button", { name: /Login/i });

    // Fill in the form so it is valid
    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "Password123!");

    // Verify initial state
    expect(submitButton).not.toBeDisabled();
    expect(submitButton).toHaveTextContent("Login");

    // Click submit
    await user.click(submitButton);

    // Verify loading/disabled state while request is in-flight
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent("Logging in...");

    // Resolve the promise to end the request
    await act(async () => {
      resolveRequest({ data: {}, error: null });
    });

    // Verify it reverts to normal after request finishes
    expect(submitButton).not.toBeDisabled();
    expect(submitButton).toHaveTextContent("Login");
  });

  it("RegisterComponent submit button displays loading and disabled state while request is in-flight", async () => {
    const user = userEvent.setup();

    // Create a deferred promise to simulate a pending request
    let resolveRequest: (value: ReturnType<typeof authClient.signUp.email>) => void;
    const pendingPromise = new Promise<ReturnType<typeof authClient.signUp.email>>((resolve) => {
      resolveRequest = resolve;
    });

    // Mock the sign-up response to stay pending
    vi.mocked(authClient.signUp.email).mockImplementation(() => pendingPromise);

    render(<RegisterComponent />);

    const nameInput = screen.getByLabelText(/Name/i);
    const emailInput = screen.getByLabelText(/Email/i);
    const passwordInput = screen.getByLabelText(/^Password$/i);
    const confirmPasswordInput = screen.getByLabelText(/Confirm Password/i);
    const submitButton = screen.getByRole("button", { name: /Sign up/i });

    // Fill in the form so it is valid
    await user.type(nameInput, "John Doe");
    await user.type(emailInput, "john@example.com");
    await user.type(passwordInput, "Password123!");
    await user.type(confirmPasswordInput, "Password123!");

    // Verify initial state
    expect(submitButton).not.toBeDisabled();
    expect(submitButton).toHaveTextContent("Sign up");

    // Click submit
    await user.click(submitButton);

    // Verify loading/disabled state while request is in-flight
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent("Creating account...");

    // Resolve the promise to end the request
    await act(async () => {
      resolveRequest({ data: {}, error: null });
    });

    // Verify it reverts to normal after request finishes
    expect(submitButton).not.toBeDisabled();
    expect(submitButton).toHaveTextContent("Sign up");
  });
});
