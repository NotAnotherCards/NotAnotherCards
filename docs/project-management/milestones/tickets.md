# Epic - Note/card content model (Markdown cards, notes, templates)

Derived from the decision in
[issue #81](https://github.com/NotAnotherCards/NotAnotherCards/issues/81):
`front`/`back` become Markdown, and structure moves to a new **note** that
sits behind generated **cards**. This epic implements the model the thread
converged on: `user_notes` holds the canonical structured/Markdown content,
`user_cards` become lean generated Markdown front/back rows tied to a note
and a template, and deck membership moves to a `user_note_decks` join table
so one note can appear in several decks with one shared schedule per card.

Scheduler/product policy raised by @devriez in the same thread —
progressive sibling activation, the "Reset word" action, same-session
sibling spacing, and the personal-dictionary/unfiled-note product rules —
is deliberately not designed by the storage tickets below (E-01 through
E-09). It is scheduler policy, not storage, and dustyway proposed giving it
its own thread rather than deciding it inline in #81. E-00 opens that
discussion; whatever it resolves comes back as new tickets appended to this
epic. The storage tickets only need the `active` flag that policy will
drive, which is already part of the E-01 schema.

No data migration is required. Per the schema-change note in the thread,
existing cards are development data and can be discarded; API and local
databases are reset when this lands.

## E-00 - Decide: sibling scheduler and product policy

Type: Discussion / Product

Depends on: none

### Goal

Reopen, as its own discussion, the product-policy questions @devriez raised
once the note/card model reached agreement in #81, and turn the outcome
into concrete tickets under this epic. This ticket produces a decision plus
follow-up tickets, not code.

### Tasks

- Open the discussion (issue or doc) covering, at minimum, the open
  questions from #81:
  - Progressive sibling activation: unlock order, thresholds, and the
    initial level/streak a newly unlocked sibling starts at.
  - "Reset word": the note-level reset (all siblings' progress reset,
    only the primary card reactivated, other modes deactivated and
    unlocked again gradually) versus a per-card `Forgot` answer.
  - Sibling spacing: same-session exclusion as a hard minimum, and whether
    multi-session spacing should exist as a user preference.
  - Personal dictionary semantics: membership removal vs. explicit
    word/progress removal, and the future "unfiled note" behavior already
    assumed by E-03/E-06.
  - The activation default question left open in E-04: which templates a
    note type generates as `active` on first generation, versus left
    `active: false` until the policy above unlocks them.
- Confirm agreement the same way #81 did: proposal, questions, agreement
  from the people listed as required reviewers on #81
  (@devriez, @dustyway, @tpandya42, @samsnwn).
- File one ticket per resolved policy area under this epic (e.g. "E-10 -
  Implement progressive sibling activation", "E-11 - Implement reset
  word"), using the same ticket structure as E-01 through E-09, and link
  them back into this file.

### Acceptance criteria

- Each open question above has either a written decision or an explicit
  "deferred past v1" note.
- New tickets exist under this epic for every decided policy area, each
  with its own goal, tasks, and acceptance criteria.
- This file is updated to list the new tickets.

### Useful links

- https://github.com/NotAnotherCards/NotAnotherCards/issues/81 (product
  rules proposed by @devriez and dustyway's agreement to split them into
  their own issue)

## E-01 - Define the note, card, and deck-membership tables

Type: Backend / Database

### Goal

Replace the current flat `user_cards` (with `deck_id`) with the agreed
three-table model: `user_notes` as the canonical source, `user_cards` as
generated rows keyed by `(note_id, template_key)`, and `user_note_decks` for
membership.

### Tasks

- Add `user_notes` to `apps/api/src/sync/schema.ts`:
  `id · user_id [server] · rev [server] · deleted_at [server] · note_type ·
  fields_version · fields_json · additional_content · created_at ·
  updated_at`.
- Change `user_cards` to: `id · user_id [server] · rev [server] ·
  deleted_at [server] · note_id NOT NULL · template_key NOT NULL · active
  NOT NULL DEFAULT true · front · back · due_at · created_at · updated_at`.
  Drop `deck_id`.
- Add `user_note_decks`: `id · user_id [server] · rev [server] · deleted_at
  [server] · note_id · deck_id · active · created_at · updated_at`.
- Add indexes: `(user_id, rev)` on all three tables (incremental pulls),
  `(note_id)` on `user_cards` and `user_note_decks`, `(deck_id)` on
  `user_note_decks`, keep the existing `(user_id, due_at)` index on
  `user_cards`.
- Decide and document the `fields_json` validation story: `note_type` +
  `fields_version` select a Zod schema server-side before accepting a push.
- Generate and run the migration. No backward-compatible data migration;
  reset dev data as agreed in the thread.
- Update `docs/database.md` and move the "Proposed `user_cards` evolution"
  section of `docs/db-schemas.md` out of "Future ideas" into the current
  schema, replaced with this model.

### Acceptance criteria

- `user_notes`, `user_cards`, and `user_note_decks` exist in the Drizzle
  schema with the columns above.
- `user_cards.note_id` and `template_key` are `NOT NULL`.
- `user_cards.deck_id` no longer exists.
- `docs/database.md` and `docs/db-schemas.md` describe the new model as
  current, not proposed.

### Useful links

- https://github.com/NotAnotherCards/NotAnotherCards/issues/81
- `docs/db-schemas.md` (see "Proposed `user_cards` evolution")

## E-02 - Update the shared offline-db package for notes and note-decks

Type: Shared package

Depends on: E-01

### Goal

Mirror the new tables in `packages/offline-db` so both API and clients share
one row/model definition, matching the existing pattern for
`user_decks`/`user_cards`.

### Tasks

**1. Row schemas (Zod)**

- Add `UserNoteRow`: `note_type`, `fields_version`, `fields_json` (validated
  per note type/version), `additional_content`, timestamps.
- Add `UserNoteDeckRow`: `note_id`, `deck_id`, `active`, timestamps.
- Update `UserCardRow`: replace `deck_id` with `note_id`, `template_key`,
  `active`.

**2. `zodTable(...)` entries**

- `userNotes = zodTable("user_notes", UserNoteRow, { indexed: [...] })`
- `userNoteDecks = zodTable("user_note_decks", UserNoteDeckRow, { indexed: [...] })`
- Update the existing `userCards = zodTable("user_cards", UserCardRow, { indexed: [...] })`
  entry: swap `deck_id` for `note_id` in its `indexed` list.

**3. `ModelFor(...)` model classes + associations**

- `UserNote extends ModelFor(userNotes)` — `has_many cards`, `has_many note_decks`.
- `UserNoteDeck extends ModelFor(userNoteDecks)` — `belongs_to UserNote`.
- Update `UserCard extends ModelFor(userCards)` — `belongs_to UserNote`
  (replacing the old `belongs_to UserDeck`).

**4. Package exports**

- Export the new row/model/record types (`UserNote`, `UserNoteDeck`, updated
  `UserCard`, and their Row/Record types) from
  `packages/offline-db/src/index.ts`.

**5. Schema-parity test**

- Update `apps/api/test/sync/schema-parity.test.ts` expectations to match
  the new wire fields (`note_id`, `template_key`, `active` on `user_cards`;
  full field set on `user_notes` / `user_note_decks`) and machinery columns.

### Acceptance criteria

- `apps/web` and `apps/api` import `UserNote`, `UserNoteDeck`, and the
  updated `UserCard` from `@repo/offline-db`.
- `schema-parity.test.ts` passes against the new Drizzle tables from E-01.
- TypeScript builds successfully across the workspace.

### Useful links

- `packages/offline-db/src/user-dictionary.ts`
- https://github.com/dustyway/remelonDB/blob/main/docs/tutorial.md#3-define-the-models

## E-03 - Wire the new tables into the sync store and cross-validation

Type: Backend

Depends on: E-01, E-02

### Goal

Extend the existing `@remelondb/store-drizzle` / `@remelondb/nestjs`
configuration to serve and validate `user_notes` and `user_note_decks`
alongside the updated `user_cards`, preserving today's ownership and
cascade guarantees.

### Tasks

- Add `createDrizzleStore(...)` configuration for `user_notes` and
  `user_note_decks`, mapping `id`, `rev`, `deletedAt`, and the `user_id`
  scope.
- Add `crossValidate` rules: a card's `note_id` must reference a note owned
  by the same authenticated scope; a note-deck row's `note_id` and
  `deck_id` must both belong to the same scope.
- Extend the tombstone cascade documented in `docs/database.md`: deleting a
  note tombstones its cards and note-deck memberships (and, transitively,
  card review events); deleting a deck tombstones its note-deck memberships
  only, never the note.
- Extend `scrub` configuration to cover `fields_json` and
  `additional_content` on tombstoned notes, matching how deck
  titles/descriptions and card fronts/backs are already scrubbed.
- Update or add integration tests: note/card/note-deck round trips,
  incremental pulls, cross-scope isolation, cascade behavior for note
  deletion vs. deck deletion, and the existing conformance suite.

### Acceptance criteria

- `/sync/pull` and `/sync/push` serve `user_notes` and `user_note_decks`.
- A card referencing another user's note is rejected.
- Deleting a deck removes membership rows only; the note and its cards
  survive with their schedules intact.
- Deleting a note cascades tombstones to its cards, note-deck memberships,
  and review events, matching the existing parent-deletion behavior for
  decks/cards.
- `registerServerConformance` passes against the updated handlers.

### Useful links

- `docs/database.md` (remelonDB bookkeeping and retention section)
- https://github.com/dustyway/remelonDB/blob/main/docs/reference/backend.md

## E-04 - Note-type template registry and card generation

Type: Shared package / Backend

Depends on: E-01, E-02

### Goal

Turn a note into its sibling cards. Implement the template mechanism the
thread agreed on: a note type defines which `template_key`s are possible
and how each renders `fields_json`/`additional_content` into Markdown
`front`/`back`.

### Tasks

- Define a template registry keyed by `note_type`, each entry mapping
  `template_key -> (fields_json) => { front, back }` in Markdown.
- Implement the `basic` note type: one template, `front`/`back` copied
  through as-is (used by manual card creation, see E-05).
- Implement one richer note type end to end (`word`, per the thread's
  example) with its `original`, `translation`, `audio`, `context`
  templates rendering from `fields_json.original` /
  `.translation` / `.pronunciation` / `.examples`.
- Implement generation/regeneration: given a note, reconcile its cards by
  `(note_id, template_key)` — update existing rows in place (preserving
  `due_at` and history) rather than replacing them, create rows for newly
  possible templates, and mark cards `active: false` when their backing
  field is removed instead of deleting them.
- A note type declares which of its possible templates start `active` on
  first generation (the thread's "ceiling, not a default" — this ticket
  only needs the declared default; the progressive-unlock policy itself is
  E-00's to decide).

### Acceptance criteria

- Generating cards from a `word` note produces the four sibling cards from
  the thread's example, sharing one `note_id`.
- Regenerating a note updates existing sibling cards in place; `due_at` and
  review history are untouched for cards whose content didn't change.
- Removing a field from a note deactivates the dependent card instead of
  deleting it.
- Unit tests cover template rendering, reconciliation, and deactivation for
  both note types.

### Useful links

- https://github.com/NotAnotherCards/NotAnotherCards/issues/81 (consolidated
  schema comment, "Templates would live in code with the generation
  prompts from #79")

## E-05 - Route manual card creation through a basic note

Type: Backend / Frontend

Depends on: E-04

### Goal

Make "create a card by hand" the `basic` note type's entry point instead of
a separate code path, per the thread's "one model, three entry points."

### Tasks

- Update card creation (`CardForm.tsx` and its API/local-write path) to
  create a `basic` `user_note` (`fields_json: { front, back }`) and
  generate its one card via E-04, instead of inserting into `user_cards`
  directly.
- Update card editing to write through the note (edit `fields_json`,
  regenerate) rather than editing `front`/`back` on the card row directly.
- Update deletion: deleting a manually created card deletes its `basic`
  note (cascades per E-03).

### Acceptance criteria

- Creating a card through the existing UI produces a `basic` note and one
  linked card.
- Editing a manually created card's front/back edits the note and
  re-renders the card in place.
- `CardForm`/`CardItem`/`CardList`/`DeckDetail` tests pass against the new
  write path.

### Useful links

- `apps/web/src/components/deck/CardForm.tsx`
- `apps/web/src/components/deck/CardItem.tsx`

## E-06 - Deck membership via user_note_decks

Type: Backend / Frontend

Depends on: E-01, E-02, E-03

### Goal

Move deck association from the card to the note, so a note can belong to
several decks while its cards keep one schedule each, per the thread's
`deck -> active membership -> note -> active cards` model.

### Tasks

- Update deck-scoped queries (deck detail, due-card queue) to reach cards
  through `deck -> user_note_decks (active) -> user_notes -> user_cards
  (active)` instead of `user_cards.deck_id`.
- Update the personal-dictionary/unfiled query to include active cards
  regardless of deck membership.
- Update deck creation/assignment UI to write `user_note_decks` rows
  instead of setting `deck_id` on the card.
- Update deck deletion to remove membership rows only (already covered by
  the cascade in E-03) and confirm cards remain reachable from the
  personal dictionary afterward.

### Acceptance criteria

- A note can belong to more than one deck, showing the same card schedule
  in both.
- Removing a deck's only membership for a note leaves the note and its
  cards visible in the personal dictionary.
- Deck detail and due-queue screens read through the membership join
  without regressions in existing deck/card tests.

### Useful links

- https://github.com/NotAnotherCards/NotAnotherCards/issues/81 (consolidated
  schema comment, "Deck membership")

## E-07 - Markdown rendering for card front/back and note content

Type: Frontend

Depends on: E-02

### Goal

Render `front`/`back` and `additional_content` as Markdown, per the
thread's "yes from me, declare front/back as markdown... we need it anyway
for the images and audio in the richer review modes."

### Tasks

- Add a sanitized Markdown renderer (e.g. a `remark`/`rehype` pipeline) as
  a shared component used by `CardItem`, `CardList`, `FlashcardModal`, and
  `DeckDetail`.
- Define the supported Markdown subset for v1: bold/italic, links, images,
  audio links (per the thread's `[🔊 audio](url)` convention), and decide
  sanitization rules for user- and AI-generated content.
- Replace the current plain-text rendering of `front`/`back` in the
  components above.

### Acceptance criteria

- Card front/back render Markdown (bold, images, audio links) instead of
  raw text in all card-review surfaces.
- Untrusted Markdown (AI output or another user's shared note, once
  applicable) cannot inject scripts or unsafe HTML.
- Existing deck/card component tests are updated for rendered output.

### Useful links

- https://github.com/NotAnotherCards/NotAnotherCards/issues/81 (perro/dog
  Markdown examples in the consolidated schema comment)

## E-08 - Full note view ("show full word")

Type: Frontend

Depends on: E-04, E-06, E-07

### Goal

Let the user open the full note behind whichever sibling card they're
reviewing, per the thread's "when the user answers any question and taps
'show full word', the app renders the note, structured fields first and
additional content below."

### Tasks

- Add a note detail view reachable from any of its cards, rendering
  `fields_json` (structured) followed by `additional_content` (Markdown).
- Add manual editing of individual `fields_json` values and
  `additional_content`, writing through the note (see E-05's write path)
  and triggering E-04's reconciliation.
- Surface which cards exist for the note and their `active` state (read
  -only in this ticket; toggling activation is scheduler policy decided in
  E-00).

### Acceptance criteria

- From any card in a review session, the user can open the note behind it
  and see all structured fields plus free-form content.
- Editing a field from this view updates the note and re-renders dependent
  cards without losing their `due_at`/history.

### Useful links

- https://github.com/NotAnotherCards/NotAnotherCards/issues/81 (consolidated
  schema comment, "Editing and regeneration")

## E-09 - Documentation pass

Type: Docs

Depends on: E-01 through E-08

### Goal

Bring `docs/db-schemas.md` and `docs/database.md` fully in line with the
implemented model, and close out the "Future ideas" entry that started
this epic.

### Tasks

- Remove the "Proposed `user_cards` evolution" entry from
  `docs/db-schemas.md`'s "Future ideas" section (superseded by E-01).
- Document `user_notes`, `user_note_decks`, and the updated `user_cards` in
  `docs/database.md`'s "App Domain Tables" section, matching the existing
  per-table writeup style (id/columns, indexes, cascade behavior).
- Note explicitly that scheduler policy (progressive activation, reset
  word, sibling spacing) is intentionally not covered by this schema and
  link to E-00 and whatever follow-up tickets it produced.
- Link this epic and issue #81 from the relevant sections for future
  readers.

### Acceptance criteria

- `docs/db-schemas.md` no longer lists this model under "Future ideas".
- `docs/database.md` documents all three tables at the same depth as the
  existing ones.

### Useful links

- `docs/db-schemas.md`
- `docs/database.md`
