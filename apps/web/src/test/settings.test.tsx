import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { authClient } from "@/lib/auth-client";
import { useStore } from "@/hooks/useStore";
import { Settings } from "../components/dashboard/Settings";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSession = {
  session: {
    id: "session-123",
    userId: "user-123",
    expiresAt: new Date(Date.now() + 3600000),
    token: "token-123",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  user: {
    id: "user-123",
    email: "john.doe@example.com",
    name: "John Doe",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

const mockProfile = {
  id: "user-123",
  username: "john_doe",
  bio: null,
  avatar_file_id: null,
  native_language_id: "00000000-0000-0000-0000-000000000001", // English
  target_language_id: "00000000-0000-0000-0000-000000000002", // Spanish
  created_at: Date.now(),
  updated_at: Date.now(),
};

vi.mock("@/hooks/useStore", () => ({
  useStore: vi.fn(),
}));

vi.mock("@remelondb/core/react", () => ({
  useDatabaseState: () => ({ status: "ready", error: null }),
  useQuery: () => ({ data: [], isLoading: false, error: null }),
  useDatabase: () => null,
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe("Settings Tab Component Specs", () => {
  const mockUpdateUserProfile = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useStore).mockReset();

    vi.mocked(useStore).mockReturnValue({
      createUserProfile: vi.fn(),
      updateUserProfile: mockUpdateUserProfile,
      profile: mockProfile,
      decks: [],
      cards: [],
      dueCards: [],
      getCardsCount: () => 0,
    } as unknown as ReturnType<typeof useStore>);

    vi.mocked(authClient.getSession).mockResolvedValue({
      data: mockSession,
      error: null,
    });
    vi.mocked(authClient.useSession).mockReturnValue({
      data: mockSession,
      isPending: false,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof authClient.useSession>);
  });

  it("pre-populates inputs with the user's active profile details", async () => {
    render(<Settings />);

    // Assert username is populated
    const usernameInput = screen.getByLabelText(/Username/i) as HTMLInputElement;
    expect(usernameInput.value).toBe("john_doe");

    // Assert native language (English) is selected
    const nativeSelect = screen.getByLabelText(/Native Language/i) as HTMLSelectElement;
    expect(nativeSelect.value).toBe("00000000-0000-0000-0000-000000000001");

    // Assert target language (Spanish) is selected
    const targetSelect = screen.getByLabelText(/Target Language/i) as HTMLSelectElement;
    expect(targetSelect.value).toBe("00000000-0000-0000-0000-000000000002");

    // Assert Save button is disabled on load (since form is clean)
    const saveBtn = screen.getByRole("button", { name: /Save Changes/i });
    expect(saveBtn).toBeDisabled();
  });

  it("navigates between sub-tabs", async () => {
    const user = userEvent.setup();
    render(<Settings />);

    // Renders profile card details by default
    expect(screen.getByText(/Profile Details/i)).toBeInTheDocument();

    // Click on Preferences / Settings sub-tab
    const settingsTabBtn = screen.getByRole("button", { name: /^Settings$/i });
    await user.click(settingsTabBtn);

    // Verify Settings card / theme changer is displayed
    expect(screen.getByText(/Theme/i)).toBeInTheDocument();
    expect(screen.getByText(/Select how the application looks to you/i)).toBeInTheDocument();

    // Click back to Profile & Languages sub-tab
    const profileTabBtn = screen.getByRole("button", { name: /Profile & Languages/i });
    await user.click(profileTabBtn);

    // Verify profile card details are back
    expect(screen.getByText(/Profile Details/i)).toBeInTheDocument();
  });

  it("filters selected native language from target language options", async () => {
    const user = userEvent.setup();
    render(<Settings />);

    const nativeSelect = screen.getByLabelText(/Native Language/i) as HTMLSelectElement;
    const targetSelect = screen.getByLabelText(/Target Language/i) as HTMLSelectElement;

    // By default, native language is English. Verify English is NOT an option in target select.
    let englishOption = Array.from(targetSelect.options).find(
      (opt) => opt.value === "00000000-0000-0000-0000-000000000001",
    );
    expect(englishOption).toBeUndefined();

    // Change Native Language to French (00000000-0000-0000-0000-000000000003)
    await user.selectOptions(nativeSelect, "00000000-0000-0000-0000-000000000003");

    // English should now be available in target language select options
    englishOption = Array.from(targetSelect.options).find(
      (opt) => opt.value === "00000000-0000-0000-0000-000000000001",
    );
    expect(englishOption).toBeDefined();

    // French should now be filtered out / unavailable in target language select options
    const frenchOption = Array.from(targetSelect.options).find(
      (opt) => opt.value === "00000000-0000-0000-0000-000000000003",
    );
    expect(frenchOption).toBeUndefined();
  });

  it("displays validation error for too-short usernames", async () => {
    const user = userEvent.setup();
    render(<Settings />);

    const usernameInput = screen.getByLabelText(/Username/i);
    await user.clear(usernameInput);
    await user.type(usernameInput, "ab");

    // Save button should become active as form is now dirty
    const saveBtn = screen.getByRole("button", { name: /Save Changes/i });
    expect(saveBtn).toBeEnabled();

    // Click submit
    await user.click(saveBtn);

    // Verify error is shown
    expect(await screen.findByText("Username must be at least 3 characters")).toBeInTheDocument();
  });

  it("saves modifications successfully and calls useStore.updateUserProfile", async () => {
    const user = userEvent.setup();
    render(<Settings />);

    const usernameInput = screen.getByLabelText(/Username/i);
    await user.clear(usernameInput);
    await user.type(usernameInput, "alex_new");

    const nativeSelect = screen.getByLabelText(/Native Language/i);
    await user.selectOptions(nativeSelect, "00000000-0000-0000-0000-000000000003"); // French

    const targetSelect = screen.getByLabelText(/Target Language/i);
    await user.selectOptions(targetSelect, "00000000-0000-0000-0000-000000000004"); // German

    const saveBtn = screen.getByRole("button", { name: /Save Changes/i });
    await user.click(saveBtn);

    // Verify database action updateUserProfile was invoked with modifications
    expect(mockUpdateUserProfile).toHaveBeenCalledWith({
      username: "alex_new",
      native_language_id: "00000000-0000-0000-0000-000000000003",
      target_language_id: "00000000-0000-0000-0000-000000000004",
    });

    // Verify success banner is shown
    expect(await screen.findByText("Settings saved successfully!")).toBeInTheDocument();
  });

  it("clears success messages once the form becomes dirty again", async () => {
    let currentProfile = { ...mockProfile };

    vi.mocked(useStore).mockReturnValue({
      createUserProfile: vi.fn(),
      updateUserProfile: (async (data: {
        username: string;
        native_language_id: string;
        target_language_id: string;
      }) => {
        currentProfile = {
          ...currentProfile,
          ...data,
        };
        vi.mocked(useStore).mockReturnValue({
          createUserProfile: vi.fn(),
          updateUserProfile: vi.fn() as unknown as ReturnType<typeof useStore>["updateUserProfile"],
          profile: currentProfile,
          decks: [],
          cards: [],
          dueCards: [],
          getCardsCount: () => 0,
        } as unknown as ReturnType<typeof useStore>);
      }) as unknown as ReturnType<typeof useStore>["updateUserProfile"],
      profile: currentProfile,
      decks: [],
      cards: [],
      dueCards: [],
      getCardsCount: () => 0,
    } as unknown as ReturnType<typeof useStore>);

    const user = userEvent.setup();
    const { rerender } = render(<Settings />);

    const usernameInput = screen.getByLabelText(/Username/i) as HTMLInputElement;
    await user.type(usernameInput, "_mod");

    const saveBtn = screen.getByRole("button", { name: /Save Changes/i });
    await user.click(saveBtn);

    // Rerender Settings to let it fetch the newly updated profile reference
    rerender(<Settings />);

    // Check success banner is shown
    expect(await screen.findByText("Settings saved successfully!")).toBeInTheDocument();

    // Wait for the form to reset back to initial clean state (which will have the new username)
    await waitFor(() => expect(usernameInput.value).toBe("john_doe_mod"));

    // Type another character to make form dirty again
    await user.type(usernameInput, "y");

    // Success banner should disappear immediately
    expect(screen.queryByText("Settings saved successfully!")).toBeNull();
  });

  it("navigates to Security subtab and renders change password form", async () => {
    const user = userEvent.setup();
    render(<Settings />);

    const securityTabBtn = screen.getByRole("button", { name: /^Security$/i });
    await user.click(securityTabBtn);

    expect(screen.getByText(/Change Password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Current Password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^New Password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm New Password/i)).toBeInTheDocument();
  });

  it("displays password validation errors for weak or non-matching inputs", async () => {
    const user = userEvent.setup();
    render(<Settings />);

    const securityTabBtn = screen.getByRole("button", { name: /^Security$/i });
    await user.click(securityTabBtn);

    const currentInput = screen.getByLabelText(/Current Password/i);
    const newInput = screen.getByLabelText(/^New Password$/i);
    const confirmInput = screen.getByLabelText(/Confirm New Password/i);
    const submitBtn = screen.getByRole("button", { name: /Update Password/i });

    // Try submitting empty
    await user.click(submitBtn);
    expect(await screen.findAllByText("Password must be at least 8 characters")).toHaveLength(3);

    // Try with mismatching passwords
    await user.type(currentInput, "OldPass123!");
    await user.type(newInput, "NewPass123!");
    await user.type(confirmInput, "DifferentPass123!");
    await user.click(submitBtn);
    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
  });

  it("submits the change password form successfully and calls authClient.changePassword", async () => {
    const user = userEvent.setup();
    vi.mocked(authClient.changePassword).mockResolvedValue({
      data: { status: true },
      error: null,
    });

    render(<Settings />);

    const securityTabBtn = screen.getByRole("button", { name: /^Security$/i });
    await user.click(securityTabBtn);

    const currentInput = screen.getByLabelText(/Current Password/i);
    const newInput = screen.getByLabelText(/^New Password$/i);
    const confirmInput = screen.getByLabelText(/Confirm New Password/i);
    const submitBtn = screen.getByRole("button", { name: /Update Password/i });

    await user.type(currentInput, "CurrentPassword1!");
    await user.type(newInput, "NewPassword123!");
    await user.type(confirmInput, "NewPassword123!");
    await user.click(submitBtn);

    await waitFor(() => {
      expect(authClient.changePassword).toHaveBeenCalledWith({
        currentPassword: "CurrentPassword1!",
        newPassword: "NewPassword123!",
        revokeOtherSessions: true,
      });
    });

    expect(await screen.findByText("Password changed successfully!")).toBeInTheDocument();
  });
});
