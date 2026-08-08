# Mobile design guide

A verbal walkthrough of the design flow in Figma (see [design.md](design.md)),
written down so mobile work can follow it without opening Figma. The canvas
is a user-flow map built from annotated DuoCards screenshots: each screen is
a reference screenshot plus add/delete/change notes describing how ours
should differ. Where the reference is language-learning specific, this doc
translates to our domain-neutral terms (deck, card front/back) and marks the
original wording in parentheses.

Source: `NotAnotherCards.png` export of the Figma canvas, state of
2026-08-08. If the Figma changes, re-export and update this doc.

This is one of two guides. The other is the web app itself: #68 targets
parity with web, so where the web already implements a feature (auth,
deck and card CRUD, settings), mobile mirrors its behavior, naming and
semantics. This doc governs flow, navigation and screen structure; the
web governs what features do.

## Navigation skeleton

Bottom tab bar with three tabs: Learning (home), Library, Account. The
reference app has a fourth Practice tab; the flow map does not use it.
Everything else hangs off these three tabs or the auth stack.

## Auth stack

- **Welcome screen**: logo, tagline, single continue button into
  register/login.
- **Register screen**: three buttons, continue with Google, with Apple, with
  email. The accounts path goes through the provider's account chooser.
- **Register with email**: email + password + repeat password, previous and
  sign-up actions. Error state for password mismatch (inline, stay on
  screen).
- **Post-registration setup** ("choose language"): one screen asking what
  the user wants to learn before landing on the main screen. For us this is
  deck selection or creation, not language pairs.
- **Login screen**: mirror of register (Google, Apple, email). The email
  path chains: wrong-password error, reset password (email entry, next),
  enter new password, mismatch error. After reset, back to login.
- Post-auth screen shows a verify-your-email banner on the account page
  rather than blocking.

What we already have on mobile: register, login, dashboard redirect. Missing
against the flow: Apple/Google buttons, the reset-password chain, the
post-registration deck setup step.

## Main screen (Learning tab)

Top to bottom:

- Header: current deck selector (dropdown, see below) and a statistics icon.
- Illustration area with a daily-points indicator (annotation: add an icon
  for daily points with the streak, like a sun).
- Three counters in a row: to learn, practiced, learned.
- Primary START button that launches a review session for the current deck.
- "My cards" section; annotation changes this to a search-card button that
  leads to the card list.

The deck selector dropdown lists decks with a per-deck to-learn count, plus
a "create new deck" row at the bottom. Switching deck switches everything
on this screen.

## Statistics

Opens from the main screen header as a separate screen (annotation:
separated window). Content:

- A per-day bar of added and checked cards over the last week, with a
  "reset words" line added after "added words".
- Total XP, current daily streak, series freeze count.
- A day / week / total selector at the top.
- Friends section with per-friend points and a global rating position;
  both depend on the selector. This is gamification we have not scoped
  yet; treat as later.

## Library tab

- **Library** ("dictionaries"): a grid of browsable shared decks with cover
  images, difficulty labels (beginner/easy/moderate/hard), card counts and
  ratings. Annotations add curated top-N lists (top 100 through 5000), a
  studied-from-this-set count, and colour change when a set is finished.
  For us this is the public/shared deck library; content types are decks,
  not languages.
- **Deck detail** ("dictionary"): the deck's cards as swipeable stacks.
  Swipe left sends a card to "to learn", swipe right to "already know".
  Tap opens the full card. A "+" button at the bottom right adds a card to
  this deck. Annotation deletes the reference's block layout in favour of
  one stack flow.

## Card list and card CRUD

- **Card list** ("search card / upload cards"): searchable list of the
  current deck's cards. Filter by card state: all, to learn, known,
  learned. Each row: front text, back preview, per-row menu with Edit,
  Reset (progress), Delete. Tapping the front text opens the full card.
  Annotations delete per-word comments and sounds from the list rows.
- **Add card**: a minimal entry form (front, back, optional usage example)
  with save. Annotation: save acts as "find card", meaning after entry the
  app decides the card type and can detect duplicates. If the card already
  exists, show a message and offer "reset progress" instead of a silent
  duplicate.
- **Card types** (from the reference, all richer views of the same idea):
  - Word card: front term with image, back translation, comment, origin,
    similar items, usage examples, mnemonic, related items. Sound plays
    per field; pen icon regenerates a field; plus icon adds a new item
    directly. For us the extra sections map to AI-generated card
    enrichment, not fixed language fields.
  - Comparison card: two related terms side by side with per-field
    comparison (meaning, register, usage). Headline per compared field.
  - Phrase card: a multi-word front with translation, fixed-expression
    note, origin, examples.
  - After save all card screens return to the main screen; back returns to
    the add-card form.

## Review flow ("repeat cards")

Started by START on the main screen. Three prompt modes for normal cards:

- Repeat translation: back side shown, recall the front.
- Repeat original sound: audio only, nothing written.
- Repeat word/phrase: front side shown.

Every prompt resolves to the same **reveal screen** ("translation"): full
answer with sound button, then swipe right = remembered, swipe left = not
remembered, undo button returns to the previous card, book icon opens the
full card, pen icon opens the full card in edit mode. Back exits to the
main screen. Comparison cards have their own repeat variant where both
terms are shown and each can be opened as a full card.

Annotations on all repeat screens: sound toggle is a button, frequency
label is shown, and when sound is globally off the sound-only mode is
skipped.

## Account tab

Rows: e-mail (with verify banner when unverified), Subscription,
Logout, Delete Account. Annotation on subscription: placeholder only,
no plan management yet. Logout and delete account both go through a
confirmation screen; delete warns that it is permanent and destroys data.
Notifications and help-center rows from the reference are not in our
scope yet.

## Gap list against the current app

Exists today: register, login, dashboard with deck list and create,
theme toggle, offline database with error banner.

To build, roughly in flow order: post-registration deck setup, bottom tab
navigation, main-screen counters and START, deck selector, card list with
state filter and edit/reset/delete, add-card form, full-card view, the
three-mode review flow with the reveal screen, library grid, deck detail
stacks, statistics screen, account tab rows. Gamification (XP, streaks,
friends, ratings) and subscription are annotated as later or placeholder.
