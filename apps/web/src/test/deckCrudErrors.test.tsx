import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import { DeckList } from "../components/deck/DeckList";
import type { Deck } from "../hooks/useStore";

// The store's write methods are async and reject on failure (a closed
// database, a failed write underneath). The deck views call them
// fire-and-forget and dismiss the dialog on the next line, so a rejection is
// dropped and the user is told the write succeeded when it did not.
//
// These tests pin the contract: the dialog closes on success and stays open
// on failure. They say nothing about how the error is surfaced, which is a
// UI decision left open.

const createDeck = vi.fn();
const updateDeck = vi.fn();
const deleteDeck = vi.fn();

const existingDeck: Deck = {
  id: "deck-1",
  title: "Spanish Verbs",
  description: "Conversational verbs",
  created_at: Date.now(),
  updated_at: Date.now(),
};

let decks: Deck[] = [];

vi.mock("@/offline/db", () => {
  const manager = {
    init: vi.fn().mockResolvedValue(undefined),
    state: { status: "ready" },
    subscribe: vi.fn(() => () => {}),
  };
  return {
    manager,
    createUserDatabaseManager: vi.fn(() => manager),
    closeUserDatabase: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/hooks/useStore", () => ({
  useStore: () => ({
    decks,
    getCardsCount: () => 0,
    isLoading: false,
    isTakenOver: false,
    error: null,
    createDeck,
    updateDeck,
    deleteDeck,
  }),
}));

const saveButton = () => screen.queryByRole("button", { name: /save deck/i });
const confirmDeleteButton = () =>
  screen.queryByRole("button", { name: /delete permanently/i });

const fillTitleAndSubmit = (title: string) => {
  fireEvent.change(screen.getByLabelText(/title/i), {
    target: { value: title },
  });
  fireEvent.submit(saveButton()!.closest("form")!);
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("deck CRUD error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    decks = [];
  });

  describe("create", () => {
    const openForm = () =>
      fireEvent.click(screen.getByRole("button", { name: /create first deck/i }));

    it("closes the dialog once the write succeeds", async () => {
      createDeck.mockResolvedValue({ id: "deck-1" });

      render(<DeckList onSelectDeck={vi.fn()} />);
      openForm();
      fillTitleAndSubmit("Spanish Verbs");

      await waitFor(() => expect(saveButton()).not.toBeInTheDocument());
    });

    it("keeps the dialog open when the write fails", async () => {
      createDeck.mockRejectedValue(new Error("database not initialized"));

      render(<DeckList onSelectDeck={vi.fn()} />);
      openForm();
      fillTitleAndSubmit("Spanish Verbs");

      await waitFor(() => expect(createDeck).toHaveBeenCalledTimes(1));
      await flush();

      expect(saveButton()).toBeInTheDocument();
    });
  });

  describe("edit", () => {
    const openForm = () => {
      decks = [existingDeck];
      render(<DeckList onSelectDeck={vi.fn()} />);
      fireEvent.click(screen.getByTitle("Edit Deck Details"));
    };

    it("keeps the dialog open when the write fails", async () => {
      updateDeck.mockRejectedValue(new Error("database not initialized"));

      openForm();
      fillTitleAndSubmit("Spanish Verbs Revised");

      await waitFor(() => expect(updateDeck).toHaveBeenCalledTimes(1));
      await flush();

      expect(saveButton()).toBeInTheDocument();
    });
  });

  describe("delete", () => {
    it("keeps the confirmation open when the write fails", async () => {
      deleteDeck.mockRejectedValue(new Error("database not initialized"));
      decks = [existingDeck];

      render(<DeckList onSelectDeck={vi.fn()} />);
      fireEvent.click(screen.getByTitle("Delete Deck"));
      fireEvent.click(confirmDeleteButton()!);

      await waitFor(() => expect(deleteDeck).toHaveBeenCalledTimes(1));
      await flush();

      expect(confirmDeleteButton()).toBeInTheDocument();
    });
  });
});
