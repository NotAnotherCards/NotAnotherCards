import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { DatabaseBanner } from "../components/DatabaseBanner";
import * as remelonReact from "@remelondb/core/react";

vi.mock("@remelondb/core/react", () => ({
  useDatabaseState: vi.fn(),
}));

describe("DatabaseBanner Component", () => {
  const mockReload = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: { ...window.location, reload: mockReload },
    });
  });

  it("renders null when status is ready", () => {
    vi.mocked(remelonReact.useDatabaseState).mockReturnValue({
      status: "ready",
      error: null,
    });

    const { container } = render(<DatabaseBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders null when status is idle", () => {
    vi.mocked(remelonReact.useDatabaseState).mockReturnValue({
      status: "idle",
      error: null,
    });

    const { container } = render(<DatabaseBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders connecting banner when status is loading", () => {
    vi.mocked(remelonReact.useDatabaseState).mockReturnValue({
      status: "loading",
      error: null,
    });

    render(<DatabaseBanner />);
    expect(screen.getByText(/Connecting Database:/i)).toBeInTheDocument();
  });

  it("renders amber banner when status is taken-over and reloads on click", () => {
    vi.mocked(remelonReact.useDatabaseState).mockReturnValue({
      status: "taken-over",
      error: null,
    });

    render(<DatabaseBanner />);
    expect(screen.getByText(/Offline Database Inactive:/i)).toBeInTheDocument();

    const button = screen.getByRole("button", { name: /Use here instead/i });
    fireEvent.click(button);
    expect(mockReload).toHaveBeenCalled();
  });

  it("explains blocked storage instead of the raw error (typed OPFS_UNAVAILABLE)", () => {
    vi.mocked(remelonReact.useDatabaseState).mockReturnValue({
      status: "error",
      error: Object.assign(
        new Error("OPFS storage is unavailable here (SecurityError)"),
        { code: "OPFS_UNAVAILABLE" },
      ),
    });

    render(<DatabaseBanner />);
    expect(
      screen.getByText(/private browsing or blocked site data/i),
    ).toBeInTheDocument();
    // not the cryptic raw error, and no retry that can't help
    expect(screen.queryByText(/Offline Database Error:/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Retry/i })).toBeNull();
  });

  it("recognizes blocked storage by message when the error carries no code", () => {
    vi.mocked(remelonReact.useDatabaseState).mockReturnValue({
      status: "error",
      error: new Error(
        "OPFS storage is unavailable here (NoModificationAllowedError)",
      ),
    });

    render(<DatabaseBanner />);
    expect(
      screen.getByText(/private browsing or blocked site data/i),
    ).toBeInTheDocument();
  });

  it("renders red banner when status is error and reloads on retry click", () => {
    vi.mocked(remelonReact.useDatabaseState).mockReturnValue({
      status: "error",
      error: new Error("Failed to initialize database"),
    });

    render(<DatabaseBanner />);
    expect(
      screen.getByText(/Failed to initialize database/i),
    ).toBeInTheDocument();

    const button = screen.getByRole("button", { name: /Retry/i });
    fireEvent.click(button);
    expect(mockReload).toHaveBeenCalled();
  });
});
