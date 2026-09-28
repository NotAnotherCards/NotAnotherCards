# Review Flow Algorithm v1

## Core Algorithm

For one selected deck:

1. Read the active, complete due cards. Take up to 10 cards, oldest `due_at`
   first, with no more than one sibling card from the same note.
2. Show this fixed batch. Save each answer before the card leaves the screen and
   before showing the next card.
3. When the batch ends, read the due cards again for the same deck. Create the
   next batch. If no cards are due, offer activation of more inactive words in
   this deck, or finish the session.

A **due card** is an active card whose `due_at` time is now or in the past and
whose required front and back content is present.
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

## Activating New Words

New words do not enter review automatically. Imported words, batch-added
words, and individually added words start inactive.

Activation is an action on a word/note, not on one separate card. Activating a
word activates all sibling cards from that note. The current `active` field
represents this note-level state by having the same value on all sibling cards.
If a word/note belongs to more than one deck, its activation and review
progress are shared across every deck that contains it.

When review has no due cards, the app offers the same action in either place:

- when review starts with no due cards; or
- when the current review session has no more due cards.

The action is: "Activate N more words from this deck".

For a basic deck, the same rule applies to cards rather than words: new cards
start inactive and the action says "Activate N more cards from this deck".

- `N` defaults to 5;
- the user can edit `N`;
- the last chosen `N` is remembered on that device;
- there is no daily limit and no global activation setting; and
- only inactive words in the selected deck are candidates for activation.

For manually or batch-added words, activate the oldest inactive words first.
For imported words, activate inactive words in their order in the import file.
The import path stores that order through the existing `created_at` value, so it
remains stable after synchronization.

An incomplete sibling card remains active when its word/note is activated, but
it is excluded from the due-card query until its required content is present.
Reconcile must not change `active` because a card is incomplete. When the
required content becomes present, reconcile sets that card's `due_at` to now,
so it is available for review immediately.
