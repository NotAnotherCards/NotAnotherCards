# Review Flow Algorithm v1

## Core Algorithm

For one selected deck:

1. Read the active due cards. Take up to 10 cards, oldest `due_at` first, with
   no more than one sibling card from the same note.
2. Show this fixed batch. Save each answer before the card leaves the screen and
   before showing the next card.
3. When the batch ends, read the due cards again for the same deck. Create the
   next batch, or finish when no cards are due.

A **due card** is an active card whose `due_at` time is now or in the past.
Sibling cards are cards created from the same note.

## Scheduling

Each answer saves a review event and updates the card's
`scheduled_interval_minutes` and `due_at` values:

```text
due_at = reviewed_at + scheduled_interval_minutes × 60,000
```

| Answer | Next interval |
| --- | --- |
| `Forgot` | 5 minutes |
| `Struggled` | `max(1 day, previous interval × 1.2)` |
| `Remembered` | `max(3 days, previous interval × 2.5)` |
| `Knew it` | `max(7 days, previous interval × 3.25)` |

The interval is stored in whole minutes and is capped at 120 days. A new card
starts with an interval of `0`.

## Edge Cases

- The batch stays fixed until it is complete. Saving an answer may change the
  global due-card list, but it must not remove the current card before its exit
  animation and the move to the next card are complete.
- An answered card is not added back to the current batch. If it becomes due
  again during the session, it may appear only in a later batch.
- When the user deletes a note, the app removes that note and every sibling
  card from the dictionary currently being reviewed. The deletion is recorded
  by setting the server-managed `deleted_at` tombstone field for the note and
  its sibling cards. Deleted cards are removed from the current batch and
  cannot be selected for a future batch.
- If deletion makes the batch empty, the app reads the due cards again and
  creates the next batch or finishes the session.

## v2 Proposal: Activating New Cards

Use the existing `active` field as the gate for new cards entering review:

- new cards start with `active = false`;
- only active cards can enter a review batch; and
- a user setting decides how many inactive cards become active each day.

The team still needs to decide whether the daily limit is per deck or global,
which cards are activated first, the priority of forgotten, manually reset,
normal due, and new cards, and whether review mode can add or activate cards
when no cards are due.
