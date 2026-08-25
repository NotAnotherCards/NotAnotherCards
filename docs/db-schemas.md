# Database schemas

## Current architecture

### Better Auth tables (server only)

These tables are generated and managed by Better Auth. Changes to authentication fields should be made through the Better Auth configuration and generation workflow, not by editing [`apps/api/src/database/schema.ts`](../apps/api/src/database/schema.ts)

#### `user` ([API schema](../apps/api/src/database/schema.ts#L4))

```text
id                  text PK
name                text NOT NULL
email               text UNIQUE NOT NULL
email_verified      boolean NOT NULL DEFAULT false
image               text NULL
created_at          timestamp NOT NULL DEFAULT now()
updated_at          timestamp NOT NULL
timezone            text NULL DEFAULT 'UTC'
```

#### `session` ([API schema](../apps/api/src/database/schema.ts#L18))

```text
id                  text PK
expires_at          timestamp NOT NULL
token               text UNIQUE NOT NULL
created_at          timestamp NOT NULL DEFAULT now()
updated_at          timestamp NOT NULL
ip_address          text NULL
user_agent          text NULL
user_id             text NOT NULL FK -> user.id ON DELETE CASCADE

INDEX(user_id)
```

#### `account` ([API schema](../apps/api/src/database/schema.ts#L37))

```text
id                        text PK
account_id                text NOT NULL
provider_id               text NOT NULL
user_id                   text NOT NULL FK -> user.id ON DELETE CASCADE
access_token              text NULL
refresh_token             text NULL
id_token                  text NULL
access_token_expires_at   timestamp NULL
refresh_token_expires_at  timestamp NULL
scope                     text NULL
password                  text NULL
created_at                timestamp NOT NULL DEFAULT now()
updated_at                timestamp NOT NULL

INDEX(user_id)
```

#### `verification` ([API schema](../apps/api/src/database/schema.ts#L61))

```text
id                  text PK
identifier          text NOT NULL
value               text NOT NULL
expires_at          timestamp NOT NULL
created_at          timestamp NOT NULL DEFAULT now()
updated_at          timestamp NOT NULL DEFAULT now()

INDEX(identifier)
```

### Synchronized application tables

The following four logical tables exist on both sides of the offline boundary. The api schema adds `user_id`, `rev`, and `deleted_at` for ownership, revision tracking, and tombstones. RemelonDB supplies its own local record metadata, so those server columns are not declared as application fields in the local Zod tables defined in [`packages/offline-db/src/user-dictionary.ts`](../packages/offline-db/src/user-dictionary.ts).

All numeric application timestamps (`due_at`, `created_at`, `updated_at`, and `reviewed_at`) are non-negative integer Unix milliseconds and must remain within JavaScript's safe-integer range. PostgreSQL stores them as `double precision`; the wire and local schemas validate them as integers found in [`apps/api/src/sync/schema.ts`](../apps/api/src/sync/schema.ts).

#### `user_decks` ([API schema](../apps/api/src/sync/schema.ts#L34), [local schema](../packages/offline-db/src/user-dictionary.ts#L37))

```text
id                  text PK
user_id             text NOT NULL FK -> user.id ON DELETE CASCADE  [server]
rev                 bigint NOT NULL                                [server]
deleted_at          timestamptz NULL                               [server]
title               text NOT NULL
description         text NULL
created_at          number (integer Unix ms) NOT NULL
updated_at          number (integer Unix ms) NOT NULL
```

#### `user_cards` ([API schema](../apps/api/src/sync/schema.ts#L62), [local schema](../packages/offline-db/src/user-dictionary.ts#L41))

Cards deliberately use generic `front` and `back` content.

```text
id                  text PK
user_id             text NOT NULL FK -> user.id ON DELETE CASCADE  [server]
rev                 bigint NOT NULL                                [server]
deleted_at          timestamptz NULL                               [server]
deck_id             text NOT NULL relation -> user_decks.id
front               text NOT NULL
back                text NOT NULL
due_at              number (integer Unix ms) NOT NULL
created_at          number (integer Unix ms) NOT NULL
updated_at          number (integer Unix ms) NOT NULL
```

The relation to `user_decks` is declared in Drizzle and RemelonDB. Database-level ownership and parent checks are enforced by the sync layer.

#### `review_events` ([API schema](../apps/api/src/sync/schema.ts#L97), [local schema](../packages/offline-db/src/user-dictionary.ts#L45))

```text
id                  text PK
user_id             text NOT NULL FK -> user.id ON DELETE CASCADE  [server]
rev                 bigint NOT NULL                                [server]
deleted_at          timestamptz NULL                               [server]
user_card_id        text NOT NULL relation -> user_cards.id
rating              integer NOT NULL CHECK (rating BETWEEN 1 AND 4)
reviewed_at         number (integer Unix ms) NOT NULL
```

Review events are append-only in the sync configuration.

#### `user_profiles` ([API schema](../apps/api/src/sync/schema.ts#L121), [local schema](../packages/offline-db/src/user-dictionary.ts#L49))

Contains app-specific profile data and is separate from Better Auth's `user` table.

```text
user_id             text PK FK -> user.id ON DELETE CASCADE
rev                 bigint NOT NULL                                [server]
deleted_at          timestamptz NULL                               [server]
username            text UNIQUE NULL
bio                 text NULL
avatar_file_id      uuid NULL
native_language_id  uuid NULL
target_language_id  uuid NULL
created_at          number (integer Unix ms) NOT NULL
updated_at          number (integer Unix ms) NOT NULL
```

The three UUID fields are currently values only; no `files` or `languages` tables or foreign-key constraints exist yet.

### Sync infrastructure

These server-only RemelonDB bookkeeping objects were introduced by [migration `0005`](../apps/api/drizzle/0005_remelon-sync-store.sql). They support synchronization and retention and do not contain application data or exist in the local schema.

#### `remelon_rev` ([API schema](../apps/api/src/sync/schema.ts#L16))

A PostgreSQL sequence that allocates the global, monotonically increasing revisions stored in synchronized rows' `rev` columns.

#### `remelon_revision_checkpoints` ([API schema](../apps/api/src/sync/schema.ts#L23))

```text
observed_at         timestamptz PK
rev                 bigint NOT NULL

INDEX(observed_at)
```

Records the highest served revision observed at a point in time. Retention uses these checkpoints to determine which tombstones are old enough to garbage-collect safely.

#### `remelon_sync_meta` ([API schema](../apps/api/src/sync/schema.ts#L18))

```text
key                 text PK
value               bigint NOT NULL
```

Stores persistent sync metadata. It currently records `gc_floor`, the oldest valid incremental-sync cursor after garbage collection.

## Future ideas

Everything in this section is exploratory and is not part of the current database contract.

### Proposed note/card content model

Decided in the discussion on
[issue #81](https://github.com/NotAnotherCards/NotAnotherCards/issues/81).
`front` and `back` become Markdown, and a note/card split (the Anki model)
replaces a single typed `user_cards` row: structure lives in a canonical **note**,
and each **card** is a generated, per-review-mode Markdown front/back row with its
own schedule.

```text
user_notes
  id                  text PK
  user_id             text NOT NULL FK -> user.id ON DELETE CASCADE  [server]
  rev                 bigint NOT NULL                                [server]
  deleted_at          timestamptz NULL                               [server]
  note_type           text NOT NULL       -- e.g. basic, word, phrase, comparison
  fields_version      integer NOT NULL
  fields_json         text NOT NULL       -- serialized JSON, validated by note_type + fields_version
  additional_content  text NULL           -- Markdown, free-form content templates don't address individually
  created_at          number (integer Unix ms) NOT NULL
  updated_at          number (integer Unix ms) NOT NULL

user_cards
  id                  text PK
  user_id             text NOT NULL FK -> user.id ON DELETE CASCADE  [server]
  rev                 bigint NOT NULL                                [server]
  deleted_at          timestamptz NULL                               [server]
  note_id             text NOT NULL relation -> user_notes.id
  template_key        text NOT NULL       -- selects the render template within note_type
  active              boolean NOT NULL DEFAULT true
  front               text NOT NULL  (Markdown content)
  back                text NOT NULL  (Markdown content)
  due_at              number (integer Unix ms) NOT NULL
  created_at          number (integer Unix ms) NOT NULL
  updated_at          number (integer Unix ms) NOT NULL

user_note_decks
  id                  text PK
  user_id             text NOT NULL FK -> user.id ON DELETE CASCADE  [server]
  rev                 bigint NOT NULL                                [server]
  deleted_at          timestamptz NULL                               [server]
  note_id             text NOT NULL relation -> user_notes.id
  deck_id             text NOT NULL relation -> user_decks.id
  active              boolean NOT NULL DEFAULT true
  created_at          number (integer Unix ms) NOT NULL
  updated_at          number (integer Unix ms) NOT NULL
```

Key points from the discussion:

- **Notes are the source of truth, cards are generated.** A card is never
  edited directly; editing a note's `fields_json`/`additional_content` and
  regenerating re-renders its cards in place, preserving `due_at` and
  review history. Cards are reconciled by `(note_id, template_key)`, not
  replaced.
- **`fields_json` is the complete structured note**, not just the values
  review templates read directly. Known values that get edited,
  regenerated, searched, or reused (translation, pronunciation, grammar,
  mnemonic, origin, examples, ...) belong in `fields_json`;
  `additional_content` is reserved for genuinely free-form Markdown. This
  intentionally accepts whole-value conflict resolution on `fields_json`
  for concurrent offline edits, revisited if it proves too coarse.
- **Sibling cards, one per review mode.** A `word` note (`original`,
  `translation`, `pronunciation`, `examples`) generates sibling cards such
  as original→translation, translation→original, audio→translation, and
  context→translation, sharing `note_id` and each with its own schedule. A
  manual front/back card is a `basic` note with one template and one card,
  not a separate code path.
- **Deck membership belongs to the note**, via `user_note_decks`, so one
  note can appear in several decks (e.g. Top 300 and a themed deck) while
  keeping one card and one schedule per review mode. Card activation is
  global to the note, not per deck.
- **Soft state vs. protocol deletion.** Removing deck membership or
  disabling a review mode sets `active = false`; both use protocol
  deletion only when their parent note or deck is deleted, cascading
  tombstones to dependent rows. A note losing its last active membership
  becomes unfiled rather than deleted, keeping it in the personal
  dictionary.
- **Deterministic identity.** `user_note_decks` and generated `user_cards`
  rows use `uuidv5` over `(note_id, deck_id)` and `(note_id, template_key)`
  respectively, so concurrent offline creation targets the same row instead
  of leaving duplicate, randomly-keyed rows to reconcile.

> No data migration is planned: existing cards are development data and can
> be discarded when this schema lands, so the API, wire, and local RemelonDB
> schemas can change together without a compatibility path.

### Proposed files/upload foundation

The current profile schemas already reserve a nullable `avatar_file_id` in the [API schema](../apps/api/src/sync/schema.ts#L131) and [local schema](../packages/offline-db/src/user-dictionary.ts#L30), but the value is not yet backed by a table or foreign-key constraint. A minimal server-side file metadata table could support avatars first and later support card images, audio, and imports without storing binary data in PostgreSQL.

#### `files`

```text
id                  uuid PK
owner_user_id       text NOT NULL FK -> user.id ON DELETE CASCADE
purpose             text NOT NULL  -- avatar | card_image | audio | import
file_name           text NOT NULL
mime_type           text NOT NULL
size_bytes          bigint NOT NULL CHECK (size_bytes > 0)
storage_key         text UNIQUE NOT NULL
created_at          timestamptz NOT NULL DEFAULT now()
updated_at          timestamptz NOT NULL DEFAULT now()
deleted_at          timestamptz NULL
```

The file bytes would live in object storage; `storage_key` would identify the object without persisting a provider-specific or permanently public URL. Download URLs should be generated by the API after authorization checks. The first implementation could restrict `purpose` to `avatar`, with the other values added only when their features are implemented.

Introducing this table would require a database migration and a foreign key from `user_profiles.avatar_file_id` to `files.id`. The upload API must validate ownership, MIME type, and size, and deletion must remove or schedule cleanup of the corresponding object. The `files` table does not need to be synchronized to RemelonDB initially: clients can continue synchronizing `avatar_file_id` and resolve its content through the API. If Markdown cards later reference uploaded media, the reference format and offline caching behavior must be defined before adding file IDs to card content.

> Future proposals should state their migration and offline-sync impact and remain in this section until added as ticket under the Task section in [this ticket](https://github.com/NotAnotherCards/NotAnotherCards/issues/131), and implemented in both the api and database where applicable.

## AI Suggestion

**WARNING!!!** This section is meant to be a reference, not the single source of truth of our future DB Schemas. I kept the suggestions for the areas we have not implemented yet.

### 1. User Related

#### `user_settings`

User app preferences.

```txt
user_id             uuid PK FK -> users.id ON DELETE CASCADE
theme               text DEFAULT 'system'       -- system | light | dark
ui_language         text DEFAULT 'en'
daily_review_goal   integer DEFAULT 20
notifications_enabled boolean DEFAULT true
sound_enabled       boolean DEFAULT true
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

---

### 2. Languages and learning preferences

#### `languages`

Languages supported by the app.

```txt
id                  uuid PK
code                text UNIQUE NOT NULL       -- en, de, es, fr
name                text NOT NULL              -- English, German, Spanish
native_name         text
direction           text DEFAULT 'ltr'         -- ltr | rtl
created_at          timestamptz DEFAULT now()
```

---

#### `user_learning_languages`

Many-to-many table for users learning multiple languages.

```txt
id                  uuid PK
user_id             uuid FK -> users.id ON DELETE CASCADE
language_id         uuid FK -> languages.id ON DELETE CASCADE
is_primary          boolean DEFAULT false
created_at          timestamptz DEFAULT now()

UNIQUE(user_id, language_id)
```

---

### 3. Global card database

The project concept has word cards, comparison cards, and phrase cards, plus fields like translation, pronunciation, frequency, etymology, examples, mnemonics, related words, and language-specific grammar.

#### `cards`

Base table for all card types.

```txt
id                  uuid PK
type                text NOT NULL              -- word | comparison | phrase
language_id         uuid FK -> languages.id NOT NULL
status              text DEFAULT 'active'      -- draft | active | flagged | archived
source              text DEFAULT 'manual'      -- manual | ai | import | seed
created_by_user_id  uuid FK -> users.id NULL
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
deleted_at          timestamptz NULL
version             integer DEFAULT 1
```

Why `version`? Useful for conflict detection later.

---

#### `word_cards`

Details for normal word cards.

```txt
card_id             uuid PK FK -> cards.id ON DELETE CASCADE
lemma               text NOT NULL              -- gehen, house, mirar
translation         text NOT NULL
part_of_speech      text                       -- noun | verb | adjective | adverb | ...
pronunciation       text
frequency_rank      integer
frequency_label     text                       -- common | uncommon | rare
etymology           text
mnemonic            text
notes               text

-- German-specific / language-specific
article             text                       -- der | die | das
gender              text                       -- masculine | feminine | neuter
plural_form         text

-- English-specific
countability        text                       -- countable | uncountable | both

-- Verb data as JSON for flexibility
verb_forms          jsonb                      -- { "present": "...", "past": "...", "participle": "..." }
```

This avoids creating separate grammar tables too early.

---

#### `phrase_cards`

Details for fixed expressions or phrases.

```txt
card_id             uuid PK FK -> cards.id ON DELETE CASCADE
phrase              text NOT NULL
translation         text NOT NULL
meaning             text
is_fixed_expression boolean DEFAULT true
frequency_label     text
notes               text
```

---

#### `comparison_cards`

Details for cards comparing similar words.

```txt
card_id             uuid PK FK -> cards.id ON DELETE CASCADE
term_a              text NOT NULL
term_b              text NOT NULL
translation_a       text
translation_b       text
difference_summary  text NOT NULL
frequency_note      text
style_note          text                       -- colloquial, formal, academic, business, etc.
typical_situations  jsonb                      -- array of use cases
notes               text
```

---

#### `card_examples`

Usage examples for any card type.

```txt
id                  uuid PK
card_id             uuid FK -> cards.id ON DELETE CASCADE
example_text        text NOT NULL
translation         text
source              text DEFAULT 'manual'      -- manual | ai | imported
created_at          timestamptz DEFAULT now()
```

---

#### `card_related_terms`

Related words or phrases.

```txt
id                  uuid PK
card_id             uuid FK -> cards.id ON DELETE CASCADE
related_text        text NOT NULL
relation_type       text                       -- synonym | antonym | same_root | same_family | commonly_used_with
translation         text
created_at          timestamptz DEFAULT now()
```

---

#### `card_tags`

Reusable tags.

```txt
id                  uuid PK
name                text UNIQUE NOT NULL       -- travel, food, business, grammar, A1
created_at          timestamptz DEFAULT now()
```

---

#### `card_tag_assignments`

Many-to-many card/tag relation.

```txt
card_id             uuid FK -> cards.id ON DELETE CASCADE
tag_id              uuid FK -> card_tags.id ON DELETE CASCADE

PRIMARY KEY(card_id, tag_id)
```

---

#### `dictionary_collections`

Ready-made dictionaries like Top-100, Top-300, Top-500.

```txt
id                  uuid PK
language_id         uuid FK -> languages.id NOT NULL
name                text NOT NULL              -- Top 100 German Words
description         text
level               text                       -- A1 | A2 | B1 | ...
is_public           boolean DEFAULT true
created_by_user_id  uuid FK -> users.id NULL
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

---

#### `dictionary_collection_cards`

Cards inside ready-made dictionaries.

```txt
collection_id       uuid FK -> dictionary_collections.id ON DELETE CASCADE
card_id             uuid FK -> cards.id ON DELETE CASCADE
position            integer

PRIMARY KEY(collection_id, card_id)
```

---

### 4. User dictionary and personal card data

The central card DB and a user’s personal dictionary should be separate. A global card can exist once, but each user has their own progress, edits, and learning status.

#### `user_cards`

Cards added to a user’s personal dictionary.

```txt
id                  uuid PK
user_id             uuid FK -> users.id ON DELETE CASCADE
card_id             uuid FK -> cards.id ON DELETE CASCADE
status              text DEFAULT 'learning'    -- new | learning | learned | suspended | archived
source              text DEFAULT 'manual'      -- manual | collection | ai | imported
offline_enabled     boolean DEFAULT false
added_at            timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()

UNIQUE(user_id, card_id)
```

---

#### `user_card_overrides`

User-specific edits to global card data.

```txt
id                  uuid PK
user_card_id        uuid FK -> user_cards.id ON DELETE CASCADE
field_path          text NOT NULL              -- "translation", "mnemonic", "examples[0].text"
value               jsonb NOT NULL
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()

UNIQUE(user_card_id, field_path)
```

This lets users edit any card without changing the global card for everyone.

---

#### `user_card_annotations`

Personal notes.

> Renamed from `user_card_notes`, decided in
> [issue #81](https://github.com/NotAnotherCards/NotAnotherCards/issues/81),
> to free up "note" for the canonical `user_notes` source record proposed
> below.

```txt
id                  uuid PK
user_card_id        uuid FK -> user_cards.id ON DELETE CASCADE
note                text NOT NULL
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

---

#### `user_card_reset_events`

When the user thought a word was learned but resets progress.

```txt
id                  uuid PK
user_card_id        uuid FK -> user_cards.id ON DELETE CASCADE
reason              text
created_at          timestamptz DEFAULT now()
```

This supports “reset progress when encountering a forgotten word in real life” idea.

---

### 5. Spaced repetition and reviews

#### `review_sessions`

One review session by a user.

```txt
id                  uuid PK
user_id             uuid FK -> users.id ON DELETE CASCADE
started_at          timestamptz DEFAULT now()
ended_at            timestamptz NULL
source              text DEFAULT 'online'      -- online | offline_synced
created_at          timestamptz DEFAULT now()
```

---

#### `user_card_progress`

Current spaced repetition state for a user card.

```txt
user_card_id        uuid PK FK -> user_cards.id ON DELETE CASCADE
user_id             uuid FK -> users.id ON DELETE CASCADE
stage               integer DEFAULT 0
ease_factor         numeric(4,2) DEFAULT 2.50
interval_days       integer DEFAULT 0
due_at              timestamptz DEFAULT now()
last_reviewed_at    timestamptz NULL
review_count        integer DEFAULT 0
success_count       integer DEFAULT 0
failure_count       integer DEFAULT 0
is_learned          boolean DEFAULT false
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

Even if our first SRS algorithm is simple, this table allows us to improve it later.

---

#### `card_reviews`

Every review result.

```txt
id                  uuid PK
user_id             uuid FK -> users.id ON DELETE CASCADE
user_card_id        uuid FK -> user_cards.id ON DELETE CASCADE
review_session_id   uuid FK -> review_sessions.id NULL
result              text NOT NULL              -- remembered | forgot | easy | hard
response_time_ms    integer NULL
reviewed_at         timestamptz NOT NULL
created_at          timestamptz DEFAULT now()

-- For offline sync/idempotency
client_mutation_id  text NULL
sync_action_id      uuid FK -> sync_actions.id NULL

UNIQUE(user_id, client_mutation_id)
```

`client_mutation_id` prevents the same offline review from being applied twice.

---

### 6. Statistics and gamification

Our concept includes learned words, due words, daily points, streaks, dictionary progress, resets, and added words per day.

#### `user_daily_stats`

Aggregated daily stats.

```txt
id                  uuid PK
user_id             uuid FK -> users.id ON DELETE CASCADE
date                date NOT NULL
reviews_count       integer DEFAULT 0
remembered_count    integer DEFAULT 0
forgot_count        integer DEFAULT 0
cards_added_count   integer DEFAULT 0
cards_reset_count   integer DEFAULT 0
points_earned       integer DEFAULT 0
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()

UNIQUE(user_id, date)
```

---

#### `user_streaks`

Current streak state.

```txt
user_id             uuid PK FK -> users.id ON DELETE CASCADE
current_streak      integer DEFAULT 0
longest_streak      integer DEFAULT 0
last_active_date    date NULL
updated_at          timestamptz DEFAULT now()
```

---

#### `achievements`

Achievement definitions.

```txt
id                  uuid PK
code                text UNIQUE NOT NULL       -- first_review, seven_day_streak
name                text NOT NULL
description         text
points              integer DEFAULT 0
created_at          timestamptz DEFAULT now()
```

---

#### `user_achievements`

Achievements unlocked by users.

```txt
user_id             uuid FK -> users.id ON DELETE CASCADE
achievement_id      uuid FK -> achievements.id ON DELETE CASCADE
unlocked_at         timestamptz DEFAULT now()

PRIMARY KEY(user_id, achievement_id)
```

---

### 7. Social features

The subject’s user interaction module includes profile, friends system, chat, online status, and real-time interaction.

#### `friend_requests`

Friend request flow.

```txt
id                  uuid PK
sender_id           uuid FK -> users.id ON DELETE CASCADE
receiver_id         uuid FK -> users.id ON DELETE CASCADE
status              text DEFAULT 'pending'     -- pending | accepted | rejected | cancelled
created_at          timestamptz DEFAULT now()
responded_at        timestamptz NULL

UNIQUE(sender_id, receiver_id)
```

---

#### `friendships`

Accepted friendships.

```txt
id                  uuid PK
user_a_id           uuid FK -> users.id ON DELETE CASCADE
user_b_id           uuid FK -> users.id ON DELETE CASCADE
created_at          timestamptz DEFAULT now()

UNIQUE(user_a_id, user_b_id)
```

Rule: store smaller UUID as `user_a_id` if we want to avoid duplicate inverse rows.

---

#### `user_blocks`

Optional, useful if we implement chat.

```txt
blocker_id          uuid FK -> users.id ON DELETE CASCADE
blocked_id          uuid FK -> users.id ON DELETE CASCADE
created_at          timestamptz DEFAULT now()

PRIMARY KEY(blocker_id, blocked_id)
```

---

#### `conversations`

For chat.

```txt
id                  uuid PK
type                text DEFAULT 'direct'      -- direct | group
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

---

#### `conversation_participants`

Users in a conversation.

```txt
conversation_id     uuid FK -> conversations.id ON DELETE CASCADE
user_id             uuid FK -> users.id ON DELETE CASCADE
joined_at           timestamptz DEFAULT now()
last_read_at        timestamptz NULL

PRIMARY KEY(conversation_id, user_id)
```

---

#### `messages`

Chat messages.

```txt
id                  uuid PK
conversation_id     uuid FK -> conversations.id ON DELETE CASCADE
sender_id           uuid FK -> users.id ON DELETE CASCADE
body                text NOT NULL
created_at          timestamptz DEFAULT now()
edited_at           timestamptz NULL
deleted_at          timestamptz NULL
```

---

### 8. Notifications and realtime

#### `notifications`

Persistent notifications.

```txt
id                  uuid PK
user_id             uuid FK -> users.id ON DELETE CASCADE
type                text NOT NULL              -- friend_request | achievement | sync_conflict | system
title               text NOT NULL
body                text
data                jsonb
read_at             timestamptz NULL
created_at          timestamptz DEFAULT now()
```

---

#### `user_presence`

Online status. Could also be in memory/Redis, but DB is fine for MVP.

```txt
user_id             uuid PK FK -> users.id ON DELETE CASCADE
status              text DEFAULT 'offline'     -- online | offline | away
last_seen_at        timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

---

### 9. AI generation and quality control

The app concept says missing words can be generated with AI and saved to the shared database, with users able to report errors and the system tracking frequently edited fields.

#### `ai_generation_requests`

Track AI usage.

```txt
id                  uuid PK
user_id             uuid FK -> users.id ON DELETE SET NULL
input_text          text NOT NULL
target_language_id  uuid FK -> languages.id
card_type           text NOT NULL              -- word | phrase | comparison
status              text DEFAULT 'pending'     -- pending | success | failed
model               text
prompt_version      text
raw_response        jsonb
error_message       text
created_card_id     uuid FK -> cards.id NULL
created_at          timestamptz DEFAULT now()
completed_at        timestamptz NULL
```

---

#### `card_reports`

User reports for wrong card data.

```txt
id                  uuid PK
card_id             uuid FK -> cards.id ON DELETE CASCADE
user_id             uuid FK -> users.id ON DELETE SET NULL
reason              text NOT NULL              -- wrong_translation | bad_example | offensive | duplicate | other
description         text
status              text DEFAULT 'open'        -- open | reviewed | resolved | rejected
created_at          timestamptz DEFAULT now()
resolved_at         timestamptz NULL
```

---

#### `card_quality_signals`

Track fields that users often edit.

```txt
id                  uuid PK
card_id             uuid FK -> cards.id ON DELETE CASCADE
field_path          text NOT NULL
edit_count          integer DEFAULT 1
last_edited_at      timestamptz DEFAULT now()

UNIQUE(card_id, field_path)
```

---

### 10. Files/uploads

Useful for avatars now, and later audio/pronunciation or imported files.

#### `files`

```txt
id                  uuid PK
owner_user_id       uuid FK -> users.id ON DELETE SET NULL
purpose             text NOT NULL              -- avatar | audio | import | attachment
file_name           text NOT NULL
mime_type           text NOT NULL
size_bytes          integer NOT NULL
storage_path        text NOT NULL
public_url          text NULL
created_at          timestamptz DEFAULT now()
deleted_at          timestamptz NULL
```

---

### 11. Public API, audit, and legal

The subject allows/mentions public API, rate limiting, documentation, privacy policy, terms, GDPR features, and README database documentation.

#### `api_keys`

For public API module if we implement it.

```txt
id                  uuid PK
user_id             uuid FK -> users.id ON DELETE CASCADE
name                text NOT NULL
key_hash            text NOT NULL
last_used_at        timestamptz NULL
created_at          timestamptz DEFAULT now()
revoked_at          timestamptz NULL
```

---

#### `api_usage_logs`

```txt
id                  uuid PK
api_key_id          uuid FK -> api_keys.id ON DELETE SET NULL
user_id             uuid FK -> users.id ON DELETE SET NULL
endpoint            text NOT NULL
method              text NOT NULL
status_code         integer
ip_address          text
created_at          timestamptz DEFAULT now()
```

---

#### `audit_logs`

Useful for debugging and evaluation.

```txt
id                  uuid PK
actor_user_id       uuid FK -> users.id ON DELETE SET NULL
action              text NOT NULL              -- user.login | card.create | review.submit | sync.apply
entity_type         text
entity_id           uuid
metadata            jsonb
created_at          timestamptz DEFAULT now()
```

---

#### `legal_documents`

Versions of Privacy Policy and Terms.

```txt
id                  uuid PK
type                text NOT NULL              -- privacy_policy | terms_of_service
version             text NOT NULL
content             text NOT NULL
published_at        timestamptz DEFAULT now()

UNIQUE(type, version)
```

---

#### `user_legal_acceptances`

Track accepted Terms/Privacy versions.

```txt
id                  uuid PK
user_id             uuid FK -> users.id ON DELETE CASCADE
legal_document_id   uuid FK -> legal_documents.id ON DELETE CASCADE
accepted_at         timestamptz DEFAULT now()

UNIQUE(user_id, legal_document_id)
```

---

#### `data_export_requests`

For GDPR/data export module.

```txt
id                  uuid PK
user_id             uuid FK -> users.id ON DELETE CASCADE
status              text DEFAULT 'pending'     -- pending | processing | ready | failed
file_id             uuid FK -> files.id NULL
requested_at        timestamptz DEFAULT now()
completed_at        timestamptz NULL
```
