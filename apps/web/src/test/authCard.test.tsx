import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthCard } from "../components/auth/auth-card";

// Mock @tanstack/react-router Link since it requires a Router context
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

describe("AuthCard Component", () => {
  it("renders the title, description, footer, and custom children correctly", () => {
    render(
      <AuthCard
        title="Test Title"
        description="Test Description"
        footerText="Test Footer Text"
        footerLinkText="Test Link"
        footerLinkTo="/test-route"
      >
        <div data-testid="test-child">Child Element</div>
      </AuthCard>
    );

    // Verify Title
    expect(screen.getByRole("heading", { name: /Test Title/i })).toBeInTheDocument();

    // Verify Description
    expect(screen.getByText("Test Description")).toBeInTheDocument();

    // Verify Footer Text & Link
    expect(screen.getByText(/Test Footer Text/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Test Link/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/test-route");

    // Verify Children are rendered properly
    expect(screen.getByTestId("test-child")).toBeInTheDocument();
    expect(screen.getByText("Child Element")).toBeInTheDocument();
  });
});
