# Remaining note/card-model tickets

Last reconciled with GitHub on 2026-08-30.

This file now contains only tickets that still require implementation. The
storage/shared-model work delivered by
[PR #180](https://github.com/NotAnotherCards/NotAnotherCards/pull/180) and
[PR #185](https://github.com/NotAnotherCards/NotAnotherCards/pull/185), including
basic-note CRUD and the shared v1 scheduler, is intentionally omitted.

The remaining scopes incorporate the model agreed in
[issue #81](https://github.com/NotAnotherCards/NotAnotherCards/issues/81) and
the accepted
[#157 decision summary](https://github.com/NotAnotherCards/NotAnotherCards/issues/157#issuecomment-5463987837),
including its post-summary four-rating clarification.

## Remaining ticket map

| ID   | GitHub state                                                                                                    |
| ---- | --------------------------------------------------------------------------------------------------------------- |
| E-03 | Existing epic ticket [#161](https://github.com/NotAnotherCards/NotAnotherCards/issues/161); still to implement. |
| E-04 | Existing epic ticket [#194](https://github.com/NotAnotherCards/NotAnotherCards/issues/194); still to implement. |
| E-06 | Ready to create under [epic #156](https://github.com/NotAnotherCards/NotAnotherCards/issues/156).               |
| E-07 | Ready to create under epic #156.                                                                                |
| E-08 | Ready to create under epic #156.                                                                                |
| E-09 | Ready to create last under epic #156.                                                                           |
| E-11 | Ready to create under epic #156.                                                                                |
| E-12 | Ready to create under epic #156.                                                                                |
| E-13 | Ready to create as an explicit v2 follow-up under epic #156.                                                    |

## Existing tickets still to implement

## E-03 - Wire the new tables into the sync store and cross-validation

GitHub: [#161](https://github.com/NotAnotherCards/NotAnotherCards/issues/161)

Invariant clarification:
[issue comment](https://github.com/NotAnotherCards/NotAnotherCards/issues/161#issuecomment-5464390185)

Type: Backend

Status: Existing open ticket; ready for implementation on the approved stack.

Depends on: #159, #160

- The server conformance and integration suites pass.

## E-04 - Define note types, templates, and card reconciliation

GitHub: [#194](https://github.com/NotAnotherCards/NotAnotherCards/issues/194)

Type: Shared package / Backend

Status: Existing open epic ticket.

Depends on: #160, #161

### Goal

Define stable versioned note schemas and turn each note into the sibling cards
supported by its current content.

### Tasks

- Define a registry keyed by `(note_type, fields_version)`, with stable
  `template_key` entries that validate fields and render Markdown
  `{ front, back }`.
- Keep the #81 `basic@1` path: `{ front, back }`, one template, and one card.
- Agree and document the complete `word@1` fields before registering it. Both
  language codes are required, but they are not by themselves a complete word
  schema.
- Define word templates for the approved fields. Do not require four cards:
  generate audio/context siblings only when their required content exists.
- Reconcile by deterministic `(note_id, template_key)`: update existing cards
  in place, create newly possible cards, and deactivate cards whose required
  content disappears. Never delete a card merely because a field is absent.
- Start every available sibling active in v1.
- When missing content returns, reactivate the existing card, preserve its ID
  and review history, and set `due_at` to now.

### Acceptance criteria

- Every registered note version has a complete strict validator and tested
  templates.
- No partially specified `word@1` record can enter the sync protocol.
- Generation creates only field-supported siblings and never assumes a fixed
  count.
- Reconciliation preserves deterministic IDs and history and resets
  reactivated cards' `due_at` to now.

## Tickets ready to publish

## E-06 - Implement automatic v1 personal collections

Type: Feature / Shared package / Web / Mobile

Depends on: #160, #161, #194

### Goal

Provide the agreed v1 `Cards` collection and one automatic collection per
study language while keeping the personal dictionary, note content, and
progress independent of membership.

### Tasks

- Define stable identifiers and lifecycle rules for the system-managed
  `Cards` collection and `All <language> Words` collections.
- Ensure `Cards` contains manually created `basic` notes.
- Ensure a created/imported word note is assigned to the collection matching
  its `original_language`/study language.
- Create a required system collection lazily or during onboarding in an
  idempotent, offline-safe way; document the chosen trigger.
- Keep all owned notes queryable from the personal dictionary even when no
  active membership exists.
- Deduplicate notes/cards reached through multiple active memberships.
- Treat server decks as import sources only; never attach personal schedule or
  history to a server catalogue row.
- Do not expose user-created thematic decks or A1/A2/B1 collection management
  in this ticket.

### Acceptance criteria

- Every manual basic note appears in `Cards` without duplicating its card.
- Every created/imported word note appears in the correct automatic language
  collection.
- Repeating collection creation/assignment is idempotent across offline clients.
- Removing a membership leaves the note, sibling cards, and history in the
  personal dictionary.
- Collection and personal-dictionary queries return each eligible card once.

## E-07 - Render Markdown card and note content safely

Type: Feature / Frontend

Depends on: #160

### Goal

Render generated `front`, `back`, and `additional_content` Markdown consistently
and safely in every card and note surface.

### Tasks

- Add one shared sanitized Markdown renderer for card list/detail, review, and
  note surfaces.
- Support the v1 subset: emphasis, links, images, and the agreed audio-link
  convention.
- Define allowed URL schemes, image/audio sources, and raw-HTML behavior for
  user-, AI-, and future catalogue-sourced content.
- Replace current plain-text `front`/`back` rendering.
- Preserve accessible link, image-alt, and audio controls.

### Acceptance criteria

- Supported Markdown renders consistently in every card/review surface.
- Scripts, unsafe HTML, event attributes, and unsafe URLs are rejected.
- Images and audio have accessible fallbacks/controls.
- Component tests cover supported rendering and sanitization failures.

## E-08 - Add the full note view ("show full word")

Type: Feature / Frontend

Depends on: #194, E-06, E-07

### Goal

Open the canonical note from any sibling card and edit it without discarding
sibling schedules or review history.

### Tasks

- Add a note detail view reachable from every sibling card.
- Render note-type-aware structured `fields_json`, followed by Markdown
  `additional_content`.
- Provide note-type-aware field editing and run #194 reconciliation after a
  valid change.
- Show generated siblings and their active/inactive state.
- Expose distinct actions for removing a membership, disabling a sibling, and
  deleting the whole note, using the safe PR #185 operations and explicit
  confirmation copy.
- Keep manual activation controls outside v1; activation follows available
  content and #194 reconciliation.

### Acceptance criteria

- Any sibling can open its full canonical note.
- Valid edits update affected siblings in place without replacing IDs or
  history.
- Removing/restoring a field deactivates/reactivates the correct sibling and
  applies the agreed `due_at = now` rule on restoration.
- A basic front/back form cannot edit a structured word note.
- Destructive actions state and apply their exact scope.

## E-09 - Complete the note/card model documentation

Type: Documentation

Depends on: #159, #160, #161, #194, E-06, E-07, E-08, E-11, E-12

### Goal

Make the database, model, scheduler, queue, and product documentation describe
the code and policy that actually ship from this epic.

### Tasks

- Document the API, wire, and local `user_notes`, `user_cards`, and
  `user_note_decks` tables, indexes, local schema version, and reset behavior.
- Document versioned note contracts, template reconciliation, deterministic
  child IDs, and the reactivation `due_at = now` rule.
- Document membership removal, sibling deactivation, whole-note deletion, and
  tombstone cascades as separate operations.
- Document the shared v1 scheduler constants, atomic review write, four-rating
  controls, and one-sibling-per-set queue rule.
- Document automatic collections and the separation between the personal
  dictionary and server catalogue.
- Remove superseded "Future ideas" text only after the corresponding stack is
  merged; retain and clearly label the post-v1 backlog.
- Link #81, #156, #157, every child ticket, and the implementing PRs.

### Acceptance criteria

- Documentation matches merged code and the accepted #157 decision record.
- No resolved v1 policy is still described as open or proposed.
- Deferred catalogue, custom-schema/deck, and scheduler work is clearly outside
  v1.
- All links and schema examples are current.

## E-11 - Enforce sibling spacing in ten-card review sets

Type: Feature / Shared package / Web / Mobile

Depends on: #160, #161, #194, E-06

### Goal

Build review sets with at most one sibling from each note, without mutating a
card's schedule merely to create spacing.

### Tasks

- Select only active due cards reachable in the requested personal-dictionary
  or collection scope.
- Deduplicate cards reached through multiple memberships.
- Build sets of at most ten cards containing at most one card per `note_id`.
- Leave excluded due siblings due and eligible for a later set.
- Define deterministic tie-breaking for multiple due siblings of one note.
- Keep wider two-set spacing and a configurable/new-sibling cap outside v1.
- Add queue tests for membership overlap, fewer than ten eligible notes,
  multiple due siblings, and successive sets.

### Acceptance criteria

- No review set contains two cards with the same `note_id`.
- One card cannot appear twice because its note has multiple memberships.
- Excluded siblings retain their original `due_at` and can appear later.
- Queue ordering/tie-breaking is deterministic and shared by Web and Mobile.
- The queue can return a smaller set when fewer than ten distinct notes are
  eligible.

## E-12 - Complete four-rating review controls and shortcuts

Type: Feature / Web / Mobile

Depends on: #160

### Goal

Expose the accepted four-rating v1 controls consistently and accessibly, using
the shared scheduler for every displayed next interval.

### Tasks

- Show four visible answer buttons mapped to ratings 1 through 4.
- Choose and document one clear label set before shipping. The discussion's
  candidates are the current `Again / Hard / Good / Easy`, the proposed
  `Forgot / Hard / Remember / Easy`, or a consistent outcome scale such as
  `Forgot / Struggled / Remembered / Knew it`. Copy must not change the stored
  rating mapping.
- Display the next interval calculated by the shared PR #185 scheduler beside
  every button.
- Update the current Web copy if the selected labels differ, without changing
  stored ratings or scheduling behavior.
- Add documented touch swipe shortcuts for ratings 1 through 3; leave rating 4
  as a visible-button action without a swipe.
- Keep all four buttons usable by pointer, keyboard navigation, and screen
  readers. Do not hide the first three buttons when swipe is available.
- Reuse the same labels, mappings, and scheduler-derived intervals on Mobile.
- Do not add selectable two-button/three-button modes in v1.

### Acceptance criteria

- Web and Mobile show four visible controls with identical labels and rating
  mappings.
- Every next-interval label matches the shared scheduler for the current card.
- Touch gestures invoke only their documented rating and never conflict with
  card flip/navigation gestures.
- Keyboard and screen-reader users can discover and activate all four ratings.
- Tests cover labels, mappings, dynamic intervals, gestures, and accessibility.

## E-13 - Add manual note-level reset after v1

Type: Feature / v2 / Shared package / Web / Mobile

Depends on: #194, E-08, the shared scheduler in #160

### Goal

Let a user deliberately restart an entire note while keeping its content,
memberships, and history, as a separate action from per-card Forgot.

### Tasks

- Add an explicit manual reset action from the full note view.
- Define the v2 reset transition for every available and inactive sibling using
  the scheduler policy current when this ticket is implemented.
- Retain all note content, memberships, card IDs, and `review_events`.
- If progressive activation exists by then, define how the reset restarts its
  unlock path; otherwise keep field-supported siblings active.
- Make confirmation copy distinguish reset from deleting the note, disabling a
  sibling, or removing a membership.
- Add shared logic and Web/Mobile tests so reset semantics cannot diverge by
  client.

### Acceptance criteria

- Reset affects all and only the selected note's sibling schedules.
- Content, memberships, deterministic card IDs, and history remain intact.
- Per-card Forgot continues to affect only the displayed card.
- The user must explicitly confirm the note-wide effect.
