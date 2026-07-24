import { describe, expect, it, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { DeckCard } from "../components/deck/DeckCard";
import { CardItem } from "../components/deck/CardItem";
import { Deck, Card } from "../hooks/useMockStore";

describe("DeckCard Component", () => {
  const mockDeck: Deck = {
    id: "deck-test-1",
    name: "Spanish Verbs",
    description: "Learn essential conversational Spanish verbs.",
    createdAt: new Date().toISOString(),
  };

  it("renders the deck name, description, and total cards badge", () => {
    render(
      <DeckCard
        deck={mockDeck}
        totalCards={12}
        onSelectDeck={vi.fn()}
        onEditDeck={vi.fn()}
        onDeleteDeck={vi.fn()}
      />
    );

    expect(screen.getByText("Spanish Verbs")).toBeInTheDocument();
    expect(screen.getByText("Learn essential conversational Spanish verbs.")).toBeInTheDocument();
    expect(screen.getByTestId("total-cards-badge")).toHaveTextContent("12");
  });

  it("calls action callbacks on click events", () => {
    const onSelectDeck = vi.fn();
    const onEditDeck = vi.fn();
    const onDeleteDeck = vi.fn();

    render(
      <DeckCard
        deck={mockDeck}
        totalCards={12}
        onSelectDeck={onSelectDeck}
        onEditDeck={onEditDeck}
        onDeleteDeck={onDeleteDeck}
      />
    );

    // Click deck title
    fireEvent.click(screen.getByText("Spanish Verbs"));
    expect(onSelectDeck).toHaveBeenCalledWith("deck-test-1");

    // Click Edit icon button
    fireEvent.click(screen.getByTitle("Edit Deck Details"));
    expect(onEditDeck).toHaveBeenCalledWith(mockDeck);

    // Click Delete icon button
    fireEvent.click(screen.getByTitle("Delete Deck"));
    expect(onDeleteDeck).toHaveBeenCalledWith("deck-test-1");
  });
});

describe("CardItem Component", () => {
  const mockCard: Card = {
    id: "card-test-1",
    deckId: "deck-test-1",
    front: "Hola",
    back: "Hello",
    notes: "Basic friendly greeting.",
    createdAt: new Date().toISOString(),
  };

  it("renders card front, back, and notes inside a table context", () => {
    render(
      <table>
        <tbody>
          <CardItem
            card={mockCard}
            onEditCard={vi.fn()}
            onDeleteCard={vi.fn()}
          />
        </tbody>
      </table>
    );

    expect(screen.getByText("Hola")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Basic friendly greeting.")).toBeInTheDocument();
  });

  it("triggers callbacks on edit and delete card actions", () => {
    const onEditCard = vi.fn();
    const onDeleteCard = vi.fn();

    render(
      <table>
        <tbody>
          <CardItem
            card={mockCard}
            onEditCard={onEditCard}
            onDeleteCard={onDeleteCard}
          />
        </tbody>
      </table>
    );

    // Click Edit button
    fireEvent.click(screen.getByTitle("Edit Card"));
    expect(onEditCard).toHaveBeenCalledWith(mockCard);

    // Click Delete button
    fireEvent.click(screen.getByTitle("Delete Card"));
    expect(onDeleteCard).toHaveBeenCalledWith("card-test-1");
  });
});
