# NotAnotherCards

It's not another flashcard app.

## Project idea

NotAnotherCards is an application for learning foreign languages based on flashcards and spaced repetition.

The main goal of the project is to solve the problems of classic flashcards, which usually show only a word and its translation. Instead, SmartFlash helps users understand word origins, connections with other languages, differences between similar words, and usage in real context.

At the first stage, the project is being developed as a cross-platform web application (PWA). Later, the architecture will allow full Android and iOS applications to be created.

# Main features

## 1. Three types of cards

### Word card

Used for learning individual words.

Can contain:

- Translation;
- pronunciation / sound;
- usage frequency;
- word origin (etymology);
- similar words in other languages;
- usage examples;
- mnemonic rules for memorization;
- related frequently used words, with the option to add them to the dictionary.

Additionally, for different parts of speech:

Nouns:

- For German: article;
- For German: gender-based color marking;
- For German: plural forms.
- For English: countable and uncountable nouns.

Verbs:

- For German: sein, haben. There may be several forms; this needs to be clarified.
- For German: kommt, kam, ist gekommen;
- For English: go, went, gone.

### Comparison card

Designed for learning similar words.

Examples:

- schauen / gucken
- wissen / kennen
- house / home

The card shows:

- the translation of each word with emphasis on the differences between them;
- pronunciation / sound;
- usage frequency;
- stylistic features (colloquial, literary, business, academic);
- typical usage situations.

The goal is to understand not only the translation, but also the difference between words.

### Phrase card

Used for learning fixed expressions and ready-made constructions.

Contains:

- translation;
- explanation of the meaning;
- a note if the expression is fixed, plus its frequency;
- usage examples.

# Spaced repetition

The learning process is based on a spaced repetition system.

The user:

- swipes right if they remember the word;
- swipes left if they do not remember it.

In the early stages, the word and translation are shown.

In later stages, the app starts checking knowledge of the word in context:

- a sentence is shown;
- the studied word is highlighted;
- the user must recall the translation or meaning.

This makes the learning process closer to real language use.

---

## Offline mode

The application should support use without an internet connection.

The user will be able to:

- review already added cards offline;
- view their personal dictionary;
- edit their own cards;
- complete spaced repetition reviews;
- save review results locally.

When the internet connection returns, the app synchronizes changes with the server:

- updates card progress;
- sends changes from edited fields;
- downloads new cards and updates;
- resolves possible conflicts between local and server data.

At the first stage, offline mode can be implemented only for cards that have already been downloaded by the user. AI generation of new cards and adding words from the central database will work only with an internet connection.

# Adaptive interface

The interface automatically adapts to the language and card type.

Examples:

For German:

- articles are displayed;
- verb forms are shown;
- gender-based color marking is used.

For English:

- the article block is hidden;
- irregular verb forms are shown.

For comparison cards:

- fields that do not make sense for this card type are hidden.

# Ready-made dictionary library

The user can start learning immediately without manually creating cards.

A set of ready-made dictionaries is planned:

- Top-100 words;
- Top-300;
- Top-500;
- Top-1000;
- Top-2000;
- Top-3000;
- Top-5000;
- Top-7000;
- Top-10000.

Words can gradually be added to the personal dictionary.

Additional thematic dictionaries can also be added by profession and domain.

# Statistics and social features

The user will be able to see:

- number of learned words;
- number of words due for review;
- number of words currently being learned;
- number of learning points earned by day;
- current learning-day streak;
- dictionary progress;
- number of cards with reset progress by day;
- number of added words by day.

Progress reset is used when a word was considered learned, but the user encountered it in real life and realized they did not remember it.

Additionally:

- friend system;
- progress comparison;
- global rankings and statistics;
- ability to search for words in the user's dictionary.

# Content and knowledge base

The project will have a central word database.

For each word, the following data will be stored:

- Card type: word, comparison, phrase;
- translation;
- frequency;
- etymology;
- related words;
- grammatical forms;
- usage examples.

At the first stage, the plan is to prepare data for the most frequent words, for example the top 1000.

# Editing and user contribution

The user will be able to edit any information in a card.

Changes are saved only for that user.

If the user adds a new word:

- The system searches for it in the database.
- If the word is missing, the card is generated with AI.
- The card is saved in the shared database.
- Other users will be able to use it in the future.

For quality control:

- users will be able to report errors;
- the system will track frequently edited fields;
- problematic cards can automatically be sent for regeneration or manual review.

# Technology stack

First version:

- React
- Django REST Framework
- PostgreSQL
- PWA

Future stages:

- Android application
- iOS application
- expansion of social features
- improvement of the AI content-generation module
