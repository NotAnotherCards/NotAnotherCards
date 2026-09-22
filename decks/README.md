# Sample decks

Decks to import for demos and onboarding (#404). Each `.txt` file is one deck,
one note per line. Build the import file and load it under Settings > Import:

    node decks/build.mjs decks/spanish-a1.txt > spanish-a1.json

The JSON is not committed. Fields per line, separated by `|`:

    word | translation | part of speech | article (el/la, empty for non-nouns) | example | example translation

Two header comments name the deck and its languages (ids from
`packages/schemas/src/user-profile.ts`):

    # title: Spanish A1
    # languages: <native language id> <target language id>

Nouns get their article on the card ("la mesa"). A word can appear once per
sense, for example `mañana` as an adverb and as a noun.

Decks so far:

- `spanish-a1.txt`: Spanish A1 for English speakers, about 500 words. Spanish of Spain, American English.
