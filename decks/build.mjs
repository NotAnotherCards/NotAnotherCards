#!/usr/bin/env node
// Turns a deck source file into the backup JSON that Settings > Import accepts.
//
//   node decks/build.mjs decks/spanish-a1.txt > spanish-a1.json
//
// Source format, one note per line, six fields separated by " | ":
//   word | translation | part of speech | article (el/la, empty for non-nouns) | example | example translation
// Lines starting with # are ignored. The first "# title:" and "# languages:"
// comments name the deck and its native/target language ids.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { ipaPhrase } from './ipa-es.mjs';

const source = process.argv[2];
if (!source) {
  console.error('usage: node decks/build.mjs <source.txt>');
  process.exit(1);
}
const lines = readFileSync(source, 'utf8').split('\n');
const header = (key) =>
  lines
    .find((l) => l.startsWith(`# ${key}:`))
    ?.slice(key.length + 3)
    .trim();
const title = header('title');
const [native, target] = (header('languages') ?? '').split(/\s+/);
if (!title || !native || !target) {
  console.error(
    `${source}: needs "# title:" and "# languages: <native id> <target id>" headers`,
  );
  process.exit(1);
}

const deckId = randomUUID();
const notes = [];
const seen = new Set();
lines.forEach((raw, i) => {
  const line = raw.trim();
  if (!line || line.startsWith('#')) return;
  const parts = line.split('|').map((p) => p.trim());
  if (parts.length !== 6) {
    console.error(`${source}:${i + 1}: expected 6 fields, got ${parts.length}`);
    process.exit(1);
  }
  const [
    word,
    translation,
    partOfSpeech,
    article,
    example,
    exampleTranslation,
  ] = parts;
  // the same word may appear once per sense, e.g. mañana as adverb and as noun
  const key = `${word}|${article}`;
  if (seen.has(key)) {
    console.error(`${source}:${i + 1}: duplicate word ${word}`);
    process.exit(1);
  }
  seen.add(key);
  notes.push({
    source_id: randomUUID(),
    note_type: 'word',
    fields_version: 1,
    fields: {
      // nouns carry their article on the card: "la mesa", "el/la estudiante"
      word: article ? `${article} ${word}` : word,
      translation,
      native_language_id: native,
      target_language_id: target,
      part_of_speech: partOfSpeech,
      example,
      example_translation: exampleTranslation,
      pronunciation: ipaPhrase(word),
      ...(article ? { gender: article } : {}),
    },
    additional_content: null,
    decks: [deckId],
    cards: [],
  });
});

process.stdout.write(
  JSON.stringify(
    {
      format: 1,
      exported_at: new Date().toISOString(),
      decks: [
        {
          source_id: deckId,
          title,
          description: `${notes.length} words with example sentences.`,
          note_type: 'word',
          native_language: native,
          target_language: target,
        },
      ],
      notes,
      review_events: [],
      media: [],
    },
    null,
    1,
  ),
);
console.error(`${notes.length} notes`);
