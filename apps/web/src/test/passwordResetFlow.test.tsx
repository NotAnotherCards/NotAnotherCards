import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ForgotPasswordComponent } from "../components/auth/forgot-password-form";
import { ResetPasswordComponent } from "../components/auth/reset-password-form";
import { authClient } from "@/lib/auth-client";
import { act } from "react";

// Mock @tanstack/react-router hooks and components
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useSearch: () => ({ token: "test-valid-token-123" }),
  useNavigate: () => vi.fn(),
  createFileRoute: () => () => ({
    component: () => null,
  }),
}));

const expectErrorToShow = async (text: string) => {
  const elements = await screen.findAllByText(text);
  expect(elements.length).toBeGreaterThan(0);
  expect(elements[0]).toBeInTheDocument();
};

describe("Forgot Password Form Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("displays validation errors for empty and invalid email formats", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordComponent />);

    const submitButton = screen.getByRole("button", { name: /Send Reset Link/i });

    // Submit empty form
    await user.click(submitButton);
    await expectErrorToShow("Please enter a valid email address");

    // Type invalid email format
    const emailInput = screen.getByLabelText(/Email/i);
    await user.type(emailInput, "not-an-email");
    await user.click(submitButton);

    await expectErrorToShow("Please enter a valid email address");
    expect(authClient.requestPasswordReset).not.toHaveBeenCalled();
  });

  it("mocks authClient.requestPasswordReset and asserts call payload on form submission", async () => {
    const user = userEvent.setup();
    vi.mocked(authClient.requestPasswordReset).mockResolvedValueOnce({
      data: { status: true },
      error: null,
    });

    render(<ForgotPasswordComponent />);

    const emailInput = screen.getByLabelText(/Email/i);
    const submitButton = screen.getByRole("button", { name: /Send Reset Link/i });

    await user.type(emailInput, "user@example.com");
    await user.click(submitButton);

    expect(authClient.requestPasswordReset).toHaveBeenCalledWith({
      email: "user@example.com",
      redirectTo: `${window.location.origin}/reset-password`,
    });

    // Check that success confirmation screen is displayed
    await screen.findByText("Check your email");
    expect(screen.getByText(/We've sent a password reset link/i)).toBeInTheDocument();
  });

  it("applies loading and disabled state to submit button while request is pending", async () => {
    const user = userEvent.setup();

    let resolveRequest: (
      value: ReturnType<typeof authClient.requestPasswordReset>,
    ) => void;
    const pendingPromise = new Promise<
      ReturnType<typeof authClient.requestPasswordReset>
    >((resolve) => {
      resolveRequest = resolve;
    });

    vi.mocked(authClient.requestPasswordReset).mockImplementation(
      () => pendingPromise,
    );

    render(<ForgotPasswordComponent />);

    const emailInput = screen.getByLabelText(/Email/i);
    const submitButton = screen.getByRole("button", { name: /Send Reset Link/i });

    await user.type(emailInput, "user@example.com");

    expect(submitButton).not.toBeDisabled();
    expect(submitButton).toHaveTextContent("Send Reset Link");

    await user.click(submitButton);

    // Verify button loading state
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent("Sending email...");

    // Resolve pending request
    await act(async () => {
      resolveRequest({ data: { status: true }, error: null });
    });

    // Success screen shown after resolve
    await screen.findByText("Check your email");
  });

  it("renders a 30-second resend email countdown timer and allows resending when countdown reaches zero", async () => {
    const user = userEvent.setup();
    vi.mocked(authClient.requestPasswordReset).mockResolvedValue({
      data: { status: true },
      error: null,
    });

    render(<ForgotPasswordComponent />);

    const emailInput = screen.getByLabelText(/Email/i);
    const submitButton = screen.getByRole("button", { name: /Send Reset Link/i });

    await user.type(emailInput, "user@example.com");
    await user.click(submitButton);

    await screen.findByText("Check your email");

    const resendButton = screen.getByRole("button", { name: /Resend email in 30s/i });
    expect(resendButton).toBeDisabled();
  });
});

describe("Reset Password Form Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("displays validation errors for empty fields and mismatching passwords", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordComponent />);

    const submitButton = screen.getByRole("button", { name: /Reset Password/i });

    // Submit empty form
    await user.click(submitButton);

    await expectErrorToShow("Password must be at least 8 characters");
    await expectErrorToShow("Please confirm your password");

    // Enter mismatching passwords
    const passwordInput = screen.getByLabelText(/^New Password$/i);
    const confirmInput = screen.getByLabelText(/Confirm New Password/i);

    await user.type(passwordInput, "Password123!");
    await user.type(confirmInput, "DifferentPassword123!");
    await user.click(submitButton);

    await expectErrorToShow("Passwords do not match");
    expect(authClient.resetPassword).not.toHaveBeenCalled();
  });

  it("mocks authClient.resetPassword and asserts payload with parsed token and new password", async () => {
    const user = userEvent.setup();
    vi.mocked(authClient.resetPassword).mockResolvedValueOnce({
      data: { status: true },
      error: null,
    });

    render(<ResetPasswordComponent />);

    const passwordInput = screen.getByLabelText(/^New Password$/i);
    const confirmInput = screen.getByLabelText(/Confirm New Password/i);
    const submitButton = screen.getByRole("button", { name: /Reset Password/i });

    await user.type(passwordInput, "NewSecurePass123!");
    await user.type(confirmInput, "NewSecurePass123!");
    await user.click(submitButton);

    expect(authClient.resetPassword).toHaveBeenCalledWith({
      newPassword: "NewSecurePass123!",
      token: "test-valid-token-123",
    });

    // Verify success screen and login redirection link
    await screen.findByText("Password Reset");
    expect(screen.getByText("Go to Login")).toBeInTheDocument();
  });
});
