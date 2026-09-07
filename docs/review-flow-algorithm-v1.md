# Review Flow Algorithm v1

## Purpose and Scope

This document defines the v1 review-session flow for one selected deck. It
defines when cards are selected, when the selection may change, and when the
session ends. It does not define the spaced-repetition interval formula or the
v2 priority policy for choosing cards.

In this document:

- a **due card** is an active card in the selected deck whose `due_at` time is
  now or in the past;
- a **note** is the source entry from which one or more cards can be generated;
- **sibling cards** are cards generated from the same note; and
- a **batch** is the fixed list of up to 10 cards shown during one part of a
  review session.

## v1 Flow

1. The user starts a review session from one selected deck. The session must
   only select cards that belong to that deck.

2. Before `ReviewSession` is displayed, the app reads the current due cards
   and creates a batch of up to 10 cards.

   - One batch must not contain two sibling cards from the same note.
   - When more eligible cards exist than available places, the selection order
     must be deterministic. The current rule is oldest `due_at` first.

3. The batch is fixed for the duration of that batch. Saving an answer may
   change the global list of due cards, but it must not change the current
   batch while its current card is still leaving the screen.

4. When the user answers a card, the app saves a new review event. Only after
   that save succeeds may the app run the card exit animation and move to the
   next card in the batch.

   - The answered card is not added back to the current batch.
   - If the scheduler makes that card due again while the review session is
     still open, it may be selected only in a later batch.
   - The current card must remain available until its exit animation has
     finished and the app has completed the move to the next step. In
     particular, updating the due-card list must not remove it early and leave
     the animation without a card to render.

5. When the user deletes a note, the app removes that note and its cards from
   the personal dictionary. It also removes every sibling card from the
   current batch.

   - If cards before the current position were removed, the current position is
     adjusted so that the next remaining card is shown.
   - If this leaves the batch empty, the app immediately checks whether it can
     create another batch for the same deck.

6. After the user finishes a batch, the app reads the current due cards for the
   same deck again and creates the next batch of up to 10 cards. It must apply
   the same one-sibling-card-per-note rule to every new batch.

7. The review session finishes only when a fresh read cannot create another
   batch because there are no due cards for the selected deck.

## Batch Lifecycle

```text
selected deck
  -> read current due cards
  -> create a fixed batch (up to 10, no sibling duplicates)
  -> save answer / complete exit animation / show next card
  -> batch complete
  -> read due cards again for the same deck
  -> next batch, or finish when no due cards remain
```

## v2 Decisions Still Needed

Version 2 should define a more detailed policy for filling the 10 places in a
batch. At minimum, the team needs to decide the priority and limits for:

- cards forgotten in the previous session;
- cards manually reset by the user;
- normal review cards that are due or overdue; and
- new cards, only when the higher-priority groups leave space in the batch.

Version 2 also needs a dictionary activation policy:

- When the app adds a dictionary received from the server, are all of its
  cards active by default?
- If not, which cards become active, when do they become active, and can the
  user activate only part of the dictionary?
- When no cards are due, should review mode offer a direct way to add cards or
  activate more cards without leaving the session?

These are product decisions, not implicit v1 behaviour. They should be agreed
before they are implemented.
