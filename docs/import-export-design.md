# Import and export: format design

Status: design, nothing implemented. Written 2026-08-28, revised 2026-08-30
against the merged schema (#180, #185). Depends on #180, #185 and #161.

Covers app module A10 (subject: Data and Analytics, Minor, "Data export and
import functionality"). The subject asks for three things: export in multiple
formats (JSON, CSV, XML, etc.), import with validation, and bulk operations
support. Our plan table says "CSV import/export", which is narrower than the
module; JSON plus CSV is the minimum that satisfies it.

The design goal beyond the module is forward compatibility. A v2 Ashtanga yoga
deck may contain an image, Sanskrit and English names, and a mnemonic per pose.
V2 may add a new package format, but it must continue to import v1 files.

## Two things will change under us

1. **The note/card model** (#156) replaces `user_cards.deck_id` and typed rows
   with notes, generated cards, and `user_note_decks`. #180 (API schema) and
   #185 (shared local and wire rows, `basic@1`, the id helpers `cardId` and
   `noteDeckId`) are approved. #161 (sync store registration and validation)
   is still open; imported rows cannot sync until it lands.
2. **Media** needs the `files` table, which is a proposal in
   [db-schemas.md](db-schemas.md), plus a reference format and offline caching,
   which that document says must be defined before file ids enter card content.

So the format must be designed against the model we are moving to, not the
tables we have. Exporting today's rows verbatim guarantees a rewrite twice.

## The format speaks notes from day one

Even before notes exist in code, the exchange format uses them. Today's cards
map to `basic` notes with one template, which is exactly the mapping the note
model already specifies for hand-entered cards. When #156 lands, the importer's
internal mapping changes and the file format does not.

```json
{
  "format": 1,
  "exported_at": "2026-08-28T09:00:00Z",
  "decks": [{ "source_id": "d1", "title": "German", "description": null }],
  "notes": [
    {
      "source_id": "n1",
      "note_type": "basic",
      "fields_version": 1,
      "fields": { "front": "der Baum", "back": "tree" },
      "additional_content": null,
      "decks": ["d1"],
      "cards": [
        {
          "source_id": "c1",
          "template_key": "front-back",
          "active": true,
          "due_at": 1756000000000,
          "scheduled_interval_minutes": 4320
        }
      ]
    }
  ],
  "review_events": [
    { "source_card_id": "c1", "rating": 3, "reviewed_at": 1755740800000 }
  ],
  "media": []
}
```

Six parts of that shape are intentional:

- `format` is an integer the importer switches on. Readers accept the versions
  they implement and reject newer ones without partially importing them.
- `source_id` values are local to the file and are never written as database
  ids. There is no `package_id`: v1 stores no provenance and has no merge.
- `fields` is validated by the built-in schema selected by `note_type` and
  `fields_version`. In v1 that is `basic@1` only.
- `cards` carries both schedule fields, `due_at` and
  `scheduled_interval_minutes`. The scheduler multiplies the previous interval,
  so a file with only `due_at` would import a card that has a due date and an
  interval of 0, the bug #185 fixed in `recordReviewEvent`. `template_key` is
  the exact string the app uses, `front-back`, because `cardId(noteId,
templateKey)` hashes it.
- `review_events` is included because it is the source of truth for
  scheduling (`docs/spaced-repetition-algorithm.md`, 4.6); the card fields are
  a projection. Import allocates fresh event ids and remaps `source_card_id` to
  the new card id.
- `media` is an empty array in v1 and the extension point for v2, so a v1 file
  is a valid v2 file.

## V2 packages media

V2 introduces `.nacpkg`, a zip containing `deck.json` and a `media/` directory.
Its manifest uses `format: 2`, and fields reference media descriptors by their
package-local ids:

```json
"media": [
  { "id": "m1", "path": "media/trikonasana.webp", "mime_type": "image/webp",
    "size_bytes": 48210, "sha256": "…" }
]
```

```json
{
  "note_type": "asana",
  "fields_version": 1,
  "fields": {
    "sanskrit": "Utthita Trikonasana",
    "english": "Extended Triangle Pose",
    "image": { "media": "m1" },
    "mnemonic": "…"
  }
}
```

Two rules keep the source note authoritative.

**Media references live in structured fields, not in Markdown card content.**
An `![alt](…)` manually added to `front` or `back` would be destroyed by card
regeneration. A `{ "media": "m1" }` value in `fields_json` survives it. The
template renders a stable media token into the generated card, and the client
resolves that token to a cached file or authorized URL at review time.

**Archive paths are data, not extraction targets.** The importer rejects
absolute paths, `..` traversal, duplicate paths, unsupported MIME types, size
limit violations, and checksum mismatches before writing notes or files.

V1 ships plain JSON only. V2 readers continue accepting those v1 files.

## V1 note types are built in

The server validates `fields_json` by selecting a schema for
`(note_type, fields_version)` from a registry in code. Today that registry
holds `basic@1` only; #185 unregistered `word@1` until its content shape is
settled. V1 import therefore accepts `basic@1` and rejects anything else with
the type and version named.

V1 writes no `note_types` array. The registry is Zod code plus rendering code,
not data, so there is nothing to serialise yet; exporting definitions waits for
the declarative format in the v2 section. Two cheap choices are made now so
that v2 is a reader change rather than a format break:

- `format` is the switch. A v2 reader accepts format 1 unchanged.
- The type namespace is reserved. Built-in identifiers are bare (`basic`).
  Custom types will be namespaced (`x-<type_key>`), and v1 rejects a
  namespaced identifier with "custom note types require format 2" rather than
  the generic unknown-type error.

## V2 user-defined note types

V2 may allow users to create note types such as `asana`. A package using one
must carry its definition because the receiving installation may not have it:

```json
"note_types": [
  { "note_type": "asana", "fields_version": 1,
    "fields": [
      { "key": "sanskrit", "type": "text", "required": true },
      { "key": "english", "type": "text", "required": true },
      { "key": "image", "type": "media", "required": false },
      { "key": "mnemonic", "type": "text", "required": false }
    ],
    "templates": [
      { "template_key": "image_sanskrit", "requires": ["image", "sanskrit"],
        "front": [{ "field": "image" }],
        "back": [{ "field": "sanskrit" }] },
      { "template_key": "sanskrit_english", "requires": ["sanskrit", "english"],
        "front": [{ "field": "sanskrit" }],
        "back": [{ "field": "english" }] }
    ] }
]
```

Definitions use a declarative field and template format. Imported templates
cannot contain JavaScript or arbitrary expressions, because a package is
untrusted content: it arrives from another user or a public deck library, and
importing one must never be a way to run code in the importer's client. This
is where Anki's HTML-and-script templates are a liability we do not want to
inherit. A generic validator checks
field keys and types, required fields, template references, and size limits.
`requires` controls conditional card generation; `front` and `back` define the
rendered card instead of relying on code the receiving app does not have.

Import rules for the section:

- A definition is validated before any note using it.
- A type already present under the same `type_key` and version must match
  exactly, or import refuses the conflict.
- Built-in types remain code-owned and are not replaced by package data.
- Type versions are immutable once notes reference them. Editing a definition
  creates a new version.

## V2 media also serves language notes

Word notes can generate audio or image siblings when the corresponding fields
exist. Language decks therefore need the same media mechanism as a future yoga
deck; the MIME type and rendering template differ, not the storage model.

```json
{
  "note_type": "word",
  "fields_version": 1,
  "fields": {
    "original": "der Baum",
    "translation": "tree",
    "original_language": "de",
    "translation_language": "en",
    "image": { "media": "m7" },
    "audio": { "media": "m8" },
    "examples": ["Der Baum ist alt."]
  }
}
```

Both fields are optional, which forces one rule the note/card model does not
state in its schema yet:

**A template generates a card only when the fields it needs are present.** A
word note without audio produces no audio card; adding audio later produces
one. Reconciliation is already by `(note_id, template_key)`, so the new sibling
appears without disturbing the schedules of the existing ones. Without this
rule, every word note gets an empty audio card and an empty picture card on
day one, and every user has to deactivate them by hand.

The image also earns its own review mode: picture to word, with no translation
shown. That is a different recall path from translation to original, and it is
the one that language teaching values most. It is a template, not a note type.

## CSV is the flat subset, and stays honest

One CSV contains `basic@1` notes. Its header is `note_type`, `fields_version`,
`front`, `back`, `additional_content`, `decks`, `card_active`, `due_at` and
`scheduled_interval_minutes`. A basic note has exactly one card, so the card's
state fits the row and a CSV round trip preserves the schedule. The `decks`
cell is a JSON array so commas and deck names survive a normal CSV parser.

CSV export refuses notes of any other type and any value it cannot represent,
and directs the user to JSON. CSV import applies the same restriction. It
never drops unsupported values.

CSV carries no review history. It is an interchange format for flat
vocabulary lists and spreadsheets; JSON is the lossless format and the backup.

## Import behaviour

- **All or nothing.** Parse and validate the whole file first: references,
  types and versions, schedule values. Report every error found. If any error
  exists, write nothing. There is no partial mode in v1.
- **Dry run** performs the same parsing, validation and id planning without
  writing, and shows the report and the counts.
- **One atomic batch.** Prepared creates are committed through a single
  `db.batch()`. `db.write()` alone is not a transaction: operations inside it
  commit one by one, and an error mid-block does not roll back the earlier
  ones (remelonDB's own `write()` doc comment).
- **Fresh destination ids.** Import allocates fresh deck and note ids, derives
  card ids with `cardId(noteId, templateKey)` and membership ids with
  `noteDeckId(noteId, deckId)`, and allocates fresh review event ids with
  `source_card_id` remapped. Importing another user's export cannot collide
  with existing rows. Re-importing the same file creates a second copy; merge
  needs provenance that v1 does not store.
- **Only active memberships are exported.** An inactive membership is how
  "remove from deck" keeps a derived id reusable; it is not user data.
  Inactive cards are exported, because they carry schedules.
- **Unknown `note_type` or higher `fields_version`** is a refusal naming the
  type and version, never a partial write.
- **Empty is not absent.** `additional_content` is nullable, so export writes
  null and empty string distinctly and import preserves the distinction.

## Where it lives

Web, under Profile & Settings: a JSON download, a CSV download, a file
picker, the dry-run report, a confirmation step, and the per-row errors.
Mobile follows after #68.

## Not in v1

- Anki `.apkg` import. It is a zipped SQLite collection with a media map, it
  earns no module points, and the module is satisfied by JSON plus CSV. Keep it
  a stretch goal. If it is ever built, `.nacpkg` is the target format it
  converts into, so the work is a converter and not a second importer.
- The `files` table, upload API, and offline media caching. Those belong to the
  file-upload module, which the plan currently declines. Pose images need them,
  and the schema proposal in `db-schemas.md` already covers storage, MIME and
  size validation, ownership and deletion, which is most of that module's
  requirements. Worth reconsidering as its own claim rather than unpaid work
  under A10.
- XML. The subject lists it as an example, not a requirement.
- Note type definitions, exported or installed. V1 has no serialisable
  registry; the declarative format is v2.
- Word notes, until `word@1` is registered again.
- Partial import, merge and deduplication.

## Schema implications

None for v1. The format is a projection of the note/card model, so it needs no
column that model does not already have.

For v2, the media work adds:

- The `files` table, with `purpose` extended from `avatar` to include
  `card_image` and `card_audio`. Note this is required by the word note's audio
  sibling card, independently of images.
- A media field value shape (`{ "media": <id> }` in a package, a file id in
  storage). No note-table change is needed because it lives inside
  `fields_json`.

User-defined note types need a synchronized definition table. One row is one
immutable type version:

```text
user_note_types
  id                  text PK
  user_id             text NOT NULL                              [server]
  rev                 bigint NOT NULL                            [server]
  deleted_at          timestamptz NULL                           [server]
  type_key            text NOT NULL
  name                text NOT NULL
  fields_version      integer NOT NULL
  definition_json     text NOT NULL
  created_at          number (integer Unix ms) NOT NULL
  updated_at          number (integer Unix ms) NOT NULL
```

Custom notes use a namespaced `note_type`, `x-<type_key>`, and keep their
existing `fields_version`. This preserves the v1 `user_notes` shape.
The sync layer must validate that the referenced type version belongs to the
same user and that `fields_json` matches its declarative definition.

## Open questions

- Does deck export include other users' shared content once a server catalogue
  exists (#157), or only the user's own notes? GDPR export implies the latter.
- Does v2 need persisted import provenance for merge and deduplication, or is
  importing another copy sufficient? V1 deliberately chooses fresh ids.

Conditional card generation is a note/card rule rather than a format rule. The
v1 generation tickets must codify the #157 decision that only templates whose
required fields are present produce active siblings.
