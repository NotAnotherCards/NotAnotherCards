import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '');
const RESULT_FILE = `${ROOT}/adjudication/fable.json`;
const BATCH_SIZE = 16;
const FORMAT =
  'Reply with only a JSON array, each element {"front": string, "back": string}. ' +
  'Front is a question or prompt, back is the answer. Keep each side under 20 words.';
const GERMAN_TEXT =
  'Der Bäcker öffnet seine Backstube jeden Morgen um vier Uhr. Er knetet den Teig, ' +
  'während die Stadt noch schläft. Um sieben Uhr duftet die ganze Straße nach frischem Brot.';
const CLOZE_TEXT =
  'Am Wochenende fährt Lena mit dem Zug zu ihrer Großmutter. Sie bringt einen Kuchen mit, ' +
  'den sie am Freitag gebacken hat. Die Großmutter freut sich immer über Besuch und kocht dann Kaffee.';
const PROMPTS = {
  spanish:
    'You generate flashcards for a spaced-repetition app. Create 5 flashcards for the topic "Spanish preterite tense for beginners". ' +
    FORMAT,
  biology:
    'You generate flashcards for a spaced-repetition app. Create 5 flashcards for the topic "photosynthesis, for a high school biology student". ' +
    FORMAT,
  german: `You generate flashcards for a spaced-repetition app. From the German text below, create 4 comprehension flashcards in German for an A2 learner. Text: "${GERMAN_TEXT}" ${FORMAT}`,
  history:
    'You generate flashcards for a spaced-repetition app. Create 5 flashcards for the topic "key events of the French Revolution with dates". ' +
    FORMAT,
  programming:
    'You generate flashcards for a spaced-repetition app. Create 5 flashcards for the topic "JavaScript array methods (map, filter, reduce)". ' +
    FORMAT,
  music:
    'You generate flashcards for a spaced-repetition app. Create 5 flashcards for the topic "music intervals for beginners (thirds, fifths, octaves)". ' +
    FORMAT,
  'de-articles':
    'You generate flashcards for a spaced-repetition language app. Create 5 flashcards for German A2 nouns. Front: the noun without article (e.g. "Tisch"). Back: definite article and plural (e.g. "der Tisch, die Tische"). Use common household nouns. ' +
    FORMAT,
  'es-ser-estar':
    'You generate flashcards for a spaced-repetition language app. Create 5 flashcards teaching when Spanish uses ser vs estar. Front: a Spanish sentence with a blank for the verb. Back: the correct conjugated form and one word saying why (e.g. "está - location"). ' +
    FORMAT,
  'de-word-cards':
    'You generate flashcards for a spaced-repetition language app. Create 5 German-to-English word cards for B1 verbs. Front: the German verb with one short German example sentence. Back: the English translation. ' +
    FORMAT,
  'de-cloze': `You generate flashcards for a spaced-repetition language app. From the German text below, create 4 cloze cards for an A2 learner: front is a sentence from the text with one word replaced by ___, back is the missing word. Text: "${CLOZE_TEXT}" ${FORMAT}`,
};

const schema = {
  type: 'object',
  properties: {
    adjudications: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          disposition: {
            enum: [
              'major_error',
              'minor_error',
              'duplicate_only',
              'judge_false_positive',
              'unresolved',
            ],
          },
          reason: { type: 'string' },
        },
        required: ['id', 'disposition', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['adjudications'],
  additionalProperties: false,
};

const opus = JSON.parse(
  fs.readFileSync(`${ROOT}/opus-adjudication.json`, 'utf8'),
);
const review = opus.results
  .filter((result) => result.opusVerdict !== 'ok' || result.qwenFlag)
  .sort((a, b) => a.id.localeCompare(b.id));
const sourceSets = new Map();

for (const campaign of new Set(review.map((result) => result.campaign))) {
  const records = fs
    .readFileSync(`${ROOT}/${campaign}.jsonl`, 'utf8')
    .trim()
    .split('\n')
    .map(JSON.parse);
  for (const record of records) {
    sourceSets.set(
      `${campaign}:${record.topic}:${record.run}`,
      record.cards ?? [],
    );
  }
}

const state = fs.existsSync(RESULT_FILE)
  ? JSON.parse(fs.readFileSync(RESULT_FILE, 'utf8'))
  : { model: 'claude-fable-5', reviewCount: review.length, results: [] };
const completed = new Set(state.results.map((result) => result.id));
const batch = review
  .filter((result) => !completed.has(result.id))
  .slice(0, BATCH_SIZE);

if (batch.length === 0) {
  console.log(
    `FULL FABLE ADJUDICATION DONE ${state.results.length}/${review.length}`,
  );
  process.exit(0);
}

const items = batch.map((result) => ({
  id: result.id,
  originalPrompt: PROMPTS[result.topic],
  targetCard: { front: result.front, back: result.back },
  generatedSet: sourceSets.get(
    `${result.campaign}:${result.topic}:${result.run}`,
  ),
}));
const prompt = `Independently adjudicate each target flashcard. The generating model and prior judge verdicts are hidden.

Use the original generation prompt and generatedSet as context. Judge the targetCard, not unrelated cards in the set. A card may rely on the deck topic stated in originalPrompt. Cross-run repetition is irrelevant because each item shows only its own generated set.

Choose exactly one disposition:
- major_error: factually wrong, teaches a false rule, answers a different question, violates the requested card type, or is malformed enough that it cannot be used as written.
- minor_error: the core answer is useful and correct, but wording, qualification, grammar, or scope should be fixed before use.
- duplicate_only: correct and usable in isolation, but duplicates another card within generatedSet. Never use this for repetition outside generatedSet.
- judge_false_positive: acceptable under the original prompt and deck context; no correction is needed.
- unresolved: specialist knowledge or an external source is required to decide.

Treat harmless concision as acceptable. Do not invent requirements absent from originalPrompt. Keep each reason concise and specific. Return exactly one adjudication for every id.

${JSON.stringify(items)}`;

const raw = execFileSync(
  'claude',
  [
    '-p',
    '--safe-mode',
    '--model',
    'fable',
    '--effort',
    'high',
    '--tools',
    '',
    '--no-session-persistence',
    '--output-format',
    'json',
    '--system-prompt',
    'You are an independent expert adjudicator of educational flashcards. Apply the supplied rubric conservatively and follow the JSON schema.',
    '--json-schema',
    JSON.stringify(schema),
  ],
  { input: prompt, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
);

const envelope = JSON.parse(raw);
const output = envelope.structured_output?.adjudications;
if (envelope.is_error || !output) {
  throw new Error(
    envelope.result || 'Fable returned no structured adjudications',
  );
}
const adjudications = new Map(output.map((result) => [result.id, result]));
if (
  adjudications.size !== batch.length ||
  batch.some(({ id }) => !adjudications.has(id))
) {
  throw new Error(
    `Expected ${batch.length} unique adjudications, received ${adjudications.size}`,
  );
}

for (const item of batch) state.results.push(adjudications.get(item.id));
state.results.sort((a, b) => a.id.localeCompare(b.id));
state.updatedAt = new Date().toISOString();
state.lastUsage = envelope.usage;
state.lastModelUsage = envelope.modelUsage;

const temporaryFile = `${RESULT_FILE}.tmp`;
fs.writeFileSync(temporaryFile, `${JSON.stringify(state, null, 2)}\n`);
fs.renameSync(temporaryFile, RESULT_FILE);

const counts = Object.fromEntries(
  Object.entries(
    Object.groupBy(state.results, (result) => result.disposition),
  ).map(([key, values]) => [key, values.length]),
);
console.log(
  `Saved ${batch.length} adjudications (${state.results.length}/${review.length}): ${JSON.stringify(counts)}`,
);
