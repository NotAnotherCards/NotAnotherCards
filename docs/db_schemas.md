# Database schema overview

I would divide the DB into these domains:

```txt
1. Auth and users
2. Languages and learning preferences
3. Global card database
4. User dictionary and custom edits
5. Spaced repetition and reviews
6. Offline sync support
7. Statistics and gamification
8. Social features
9. Notifications and realtime
10. AI generation and quality control
11. Files/uploads
12. Public API and audit/legal
```

---

# 1. Auth and users

## `users`

Main user table. Better Auth may provide this.

```txt
id                  uuid PK
email               text UNIQUE NOT NULL
email_verified      boolean DEFAULT false
name                text
username            text UNIQUE
image               text
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
deleted_at          timestamptz NULL
```

Use `deleted_at` for soft deletion/GDPR flows.

---

## `sessions`

User login sessions. Better Auth may provide this.

```txt
id                  uuid PK
user_id             uuid FK -> users.id ON DELETE CASCADE
token               text UNIQUE NOT NULL
expires_at          timestamptz NOT NULL
ip_address          text
user_agent          text
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

---

## `accounts`

OAuth/provider accounts if we later add GitHub/Google/42 login. Better Auth may provide this.

```txt
id                  uuid PK
user_id             uuid FK -> users.id ON DELETE CASCADE
provider_id         text NOT NULL
account_id          text NOT NULL
access_token        text NULL
refresh_token       text NULL
access_token_expires_at timestamptz NULL
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()

UNIQUE(provider_id, account_id)
```

---

## `verifications`

Email verification, password reset, etc. Better Auth may provide this.

```txt
id                  uuid PK
identifier          text NOT NULL
value               text NOT NULL
expires_at          timestamptz NOT NULL
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

---

## `user_profiles`

App-specific profile data.

```txt
user_id             uuid PK FK -> users.id ON DELETE CASCADE
display_name        text
bio                 text
avatar_file_id      uuid FK -> files.id NULL
native_language_id  uuid FK -> languages.id NULL
target_language_id  uuid FK -> languages.id NULL
timezone            text DEFAULT 'UTC'
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

---

## `user_settings`

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

# 2. Languages and learning preferences

## `languages`

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

## `user_learning_languages`

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

# 3. Global card database

The project concept has word cards, comparison cards, and phrase cards, plus fields like translation, pronunciation, frequency, etymology, examples, mnemonics, related words, and language-specific grammar.

## `cards`

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

## `word_cards`

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

## `phrase_cards`

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

## `comparison_cards`

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

## `card_examples`

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

## `card_related_terms`

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

## `card_tags`

Reusable tags.

```txt
id                  uuid PK
name                text UNIQUE NOT NULL       -- travel, food, business, grammar, A1
created_at          timestamptz DEFAULT now()
```

---

## `card_tag_assignments`

Many-to-many card/tag relation.

```txt
card_id             uuid FK -> cards.id ON DELETE CASCADE
tag_id              uuid FK -> card_tags.id ON DELETE CASCADE

PRIMARY KEY(card_id, tag_id)
```

---

## `dictionary_collections`

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

## `dictionary_collection_cards`

Cards inside ready-made dictionaries.

```txt
collection_id       uuid FK -> dictionary_collections.id ON DELETE CASCADE
card_id             uuid FK -> cards.id ON DELETE CASCADE
position            integer

PRIMARY KEY(collection_id, card_id)
```

---

# 4. User dictionary and personal card data

The central card DB and a user’s personal dictionary should be separate. A global card can exist once, but each user has their own progress, edits, and learning status.

## `user_cards`

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

## `user_card_overrides`

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

## `user_card_notes`

Personal notes.

```txt
id                  uuid PK
user_card_id        uuid FK -> user_cards.id ON DELETE CASCADE
note                text NOT NULL
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

---

## `user_card_reset_events`

When the user thought a word was learned but resets progress.

```txt
id                  uuid PK
user_card_id        uuid FK -> user_cards.id ON DELETE CASCADE
reason              text
created_at          timestamptz DEFAULT now()
```

This supports “reset progress when encountering a forgotten word in real life” idea.

---

# 5. Spaced repetition and reviews

## `review_sessions`

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

## `user_card_progress`

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

## `card_reviews`

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

# 6. Offline sync support

Dexie/IndexedDB will have local tables, but the backend should also track synced offline mutations so repeated syncs are safe.

## `sync_actions`

Server-side record of offline actions received from clients.

```txt
id                  uuid PK
user_id             uuid FK -> users.id ON DELETE CASCADE
client_action_id    text NOT NULL
action_type         text NOT NULL              -- CARD_REVIEWED | CARD_EDITED | CARD_ADDED | CARD_RESET
payload             jsonb NOT NULL
status              text DEFAULT 'pending'     -- pending | applied | failed | conflict
error_message       text NULL
created_offline_at  timestamptz NULL
received_at         timestamptz DEFAULT now()
applied_at          timestamptz NULL

UNIQUE(user_id, client_action_id)
```

This is our safety table for offline writes.

---

## `sync_conflicts`

Conflicts detected during sync.

```txt
id                  uuid PK
sync_action_id      uuid FK -> sync_actions.id ON DELETE CASCADE
user_id             uuid FK -> users.id ON DELETE CASCADE
entity_type         text NOT NULL              -- user_card | card_review | user_card_override
entity_id           uuid NULL
server_value        jsonb
client_value        jsonb
resolution          text DEFAULT 'unresolved'  -- unresolved | client_wins | server_wins | manual
resolved_at         timestamptz NULL
created_at          timestamptz DEFAULT now()
```

For MVP, most review actions should be append-only and conflict-free. This table is mainly for card edits.

---

# 7. Statistics and gamification

Our concept includes learned words, due words, daily points, streaks, dictionary progress, resets, and added words per day.

## `user_daily_stats`

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

## `user_streaks`

Current streak state.

```txt
user_id             uuid PK FK -> users.id ON DELETE CASCADE
current_streak      integer DEFAULT 0
longest_streak      integer DEFAULT 0
last_active_date    date NULL
updated_at          timestamptz DEFAULT now()
```

---

## `achievements`

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

## `user_achievements`

Achievements unlocked by users.

```txt
user_id             uuid FK -> users.id ON DELETE CASCADE
achievement_id      uuid FK -> achievements.id ON DELETE CASCADE
unlocked_at         timestamptz DEFAULT now()

PRIMARY KEY(user_id, achievement_id)
```

---

# 8. Social features

The subject’s user interaction module includes profile, friends system, chat, online status, and real-time interaction.

## `friend_requests`

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

## `friendships`

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

## `user_blocks`

Optional, useful if we implement chat.

```txt
blocker_id          uuid FK -> users.id ON DELETE CASCADE
blocked_id          uuid FK -> users.id ON DELETE CASCADE
created_at          timestamptz DEFAULT now()

PRIMARY KEY(blocker_id, blocked_id)
```

---

## `conversations`

For chat.

```txt
id                  uuid PK
type                text DEFAULT 'direct'      -- direct | group
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

---

## `conversation_participants`

Users in a conversation.

```txt
conversation_id     uuid FK -> conversations.id ON DELETE CASCADE
user_id             uuid FK -> users.id ON DELETE CASCADE
joined_at           timestamptz DEFAULT now()
last_read_at        timestamptz NULL

PRIMARY KEY(conversation_id, user_id)
```

---

## `messages`

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

# 9. Notifications and realtime

## `notifications`

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

## `user_presence`

Online status. Could also be in memory/Redis, but DB is fine for MVP.

```txt
user_id             uuid PK FK -> users.id ON DELETE CASCADE
status              text DEFAULT 'offline'     -- online | offline | away
last_seen_at        timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

---

# 10. AI generation and quality control

The app concept says missing words can be generated with AI and saved to the shared database, with users able to report errors and the system tracking frequently edited fields.

## `ai_generation_requests`

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

## `card_reports`

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

## `card_quality_signals`

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

# 11. Files/uploads

Useful for avatars now, and later audio/pronunciation or imported files.

## `files`

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

# 12. Public API, audit, and legal

The subject allows/mentions public API, rate limiting, documentation, privacy policy, terms, GDPR features, and README database documentation.

## `api_keys`

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

## `api_usage_logs`

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

## `audit_logs`

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

## `legal_documents`

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

## `user_legal_acceptances`

Track accepted Terms/Privacy versions.

```txt
id                  uuid PK
user_id             uuid FK -> users.id ON DELETE CASCADE
legal_document_id   uuid FK -> legal_documents.id ON DELETE CASCADE
accepted_at         timestamptz DEFAULT now()

UNIQUE(user_id, legal_document_id)
```

---

## `data_export_requests`

For GDPR/data export module.

```txt
id                  uuid PK
user_id             uuid FK -> users.id ON DELETE CASCADE
status              text DEFAULT 'pending'     -- pending | processing | ready | failed
file_id             uuid FK -> files.id NULL
requested_at        timestamptz DEFAULT now()
completed_at        timestamptz NULL
```

---

# Local Dexie / IndexedDB schema

This is not PostgreSQL, but we should document it because offline is central to the project.

```txt
local_cards
- id
- server_card_id
- type
- language_id
- data
- server_version
- downloaded_at
- updated_at

local_user_cards
- id
- server_user_card_id
- server_card_id
- status
- offline_enabled
- data
- updated_at

local_user_card_progress
- server_user_card_id
- stage
- interval_days
- due_at
- last_reviewed_at
- review_count
- updated_at

sync_queue
- id
- client_action_id
- action_type
- payload
- status              -- pending | syncing | synced | failed | conflict
- created_at
- last_attempt_at
- error_message
```
