import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const OUT = '/tmp/campaign';
const RESULT_FILE = `${OUT}/opus-adjudication.json`;
const SAMPLE_RATE = 1;
const BATCH_SIZE = 12;

const schema = {
  type: 'object',
  properties: {
    judgments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          verdict: { enum: ['ok', 'error', 'uncertain'] },
          detail: { type: 'string' },
        },
        required: ['id', 'verdict', 'detail'],
        additionalProperties: false,
      },
    },
  },
  required: ['judgments'],
  additionalProperties: false,
};

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function signature(card) {
  return JSON.stringify([card.topic, card.run, card.front, card.back]);
}

function selectedBySample(id) {
  return Number.parseInt(hash(id).slice(0, 8), 16) / 0x100000000 < SAMPLE_RATE;
}

function loadCandidates() {
  const candidates = [];
  const auditFiles = fs
    .readdirSync(OUT)
    .filter((name) => name.endsWith('.audit.json'))
    .sort();

  for (const auditFile of auditFiles) {
    const campaign = auditFile.slice(0, -'.audit.json'.length);
    const sourceFile = `${OUT}/${campaign}.jsonl`;
    if (!fs.existsSync(sourceFile)) continue;

    const flags = JSON.parse(fs.readFileSync(`${OUT}/${auditFile}`, 'utf8'));
    const flagCounts = new Map();
    const flagDetails = new Map();
    for (const flag of flags) {
      const key = signature(flag);
      flagCounts.set(key, (flagCounts.get(key) ?? 0) + 1);
      if (!flagDetails.has(key)) flagDetails.set(key, flag);
    }

    const sets = fs
      .readFileSync(sourceFile, 'utf8')
      .trim()
      .split('\n')
      .map(JSON.parse);
    let cardIndex = 0;
    for (const set of sets) {
      if (!set.parseOk || !set.cards) continue;
      for (const card of set.cards) {
        const source = { topic: set.topic, run: set.run, ...card };
        const key = signature(source);
        const isFlagged = (flagCounts.get(key) ?? 0) > 0;
        if (isFlagged) flagCounts.set(key, flagCounts.get(key) - 1);
        const id = `item-${hash(`${campaign}:${cardIndex}:${key}`).slice(0, 16)}`;
        cardIndex++;
        if (!isFlagged && !selectedBySample(id)) continue;

        candidates.push({
          id,
          campaign,
          ...source,
          qwenFlag: isFlagged,
          qwenFinding: isFlagged ? flagDetails.get(key) : null,
        });
      }
    }
  }

  return candidates.sort(
    (a, b) =>
      Number(b.qwenFlag) - Number(a.qwenFlag) || a.id.localeCompare(b.id),
  );
}

const state = fs.existsSync(RESULT_FILE)
  ? JSON.parse(fs.readFileSync(RESULT_FILE, 'utf8'))
  : { model: 'claude-opus', sampleRate: SAMPLE_RATE, results: [] };
state.sampleRate = SAMPLE_RATE;
const completed = new Set(state.results.map((result) => result.id));
const batch = loadCandidates()
  .filter((candidate) => !completed.has(candidate.id))
  .slice(0, BATCH_SIZE);

if (batch.length === 0) {
  console.log('No eligible cards remain in completed campaigns.');
  process.exit(0);
}

const groundedDocuments = {
  german:
    'Der Bäcker öffnet seine Backstube jeden Morgen um vier Uhr. Er knetet den Teig, während die Stadt noch schläft. Um sieben Uhr duftet die ganze Straße nach frischem Brot.',
  'de-cloze':
    'Am Wochenende fährt Lena mit dem Zug zu ihrer Großmutter. Sie bringt einen Kuchen mit, den sie am Freitag gebacken hat. Die Großmutter freut sich immer über Besuch und kocht dann Kaffee.',
};
const judgeItems = batch.map(({ id, topic, front, back }) => ({
  id,
  topic,
  front,
  back,
  ...(groundedDocuments[topic] && { sourceDocument: groundedDocuments[topic] }),
}));

const prompt = `Independently audit every flashcard in the JSON array below. The generating model and any prior verdict are intentionally hidden.

For each item, decide whether the answer is factually correct, coherent, well-formed, and suitable for learning. Be strict about language spelling, accents, umlauts, articles, plural forms, invented words, and whether the answer teaches the requested rule. For items with sourceDocument, also require the card to be supported by that document. Use "uncertain" rather than guessing when external verification would be needed. Return exactly one judgment for every input id. Keep detail concise and specific; for "ok", briefly state why.

${JSON.stringify(judgeItems)}`;

const raw = execFileSync(
  'claude',
  [
    '-p',
    '--safe-mode',
    '--model',
    'opus',
    '--effort',
    'high',
    '--tools',
    '',
    '--no-session-persistence',
    '--output-format',
    'json',
    '--system-prompt',
    'You are an independent expert evaluator of educational flashcards. Follow the requested JSON schema and do not infer anything about the generating model.',
    '--json-schema',
    JSON.stringify(schema),
  ],
  { input: prompt, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
);

const envelope = JSON.parse(raw);
if (envelope.is_error || !envelope.structured_output?.judgments) {
  throw new Error(envelope.result || 'Claude returned no structured judgments');
}

const judgments = new Map(
  envelope.structured_output.judgments.map((judgment) => [
    judgment.id,
    judgment,
  ]),
);
if (
  judgments.size !== batch.length ||
  batch.some(({ id }) => !judgments.has(id))
) {
  throw new Error(
    `Expected ${batch.length} unique judgments, received ${judgments.size}`,
  );
}

for (const candidate of batch) {
  const judgment = judgments.get(candidate.id);
  state.results.push({
    ...candidate,
    opusVerdict: judgment.verdict,
    opusDetail: judgment.detail,
  });
}
state.updatedAt = new Date().toISOString();
state.lastUsage = envelope.usage;
state.lastModelUsage = envelope.modelUsage;

const temporaryFile = `${RESULT_FILE}.tmp`;
fs.writeFileSync(temporaryFile, `${JSON.stringify(state, null, 2)}\n`);
fs.renameSync(temporaryFile, RESULT_FILE);

const counts = Object.groupBy(state.results, (result) => result.opusVerdict);
console.log(
  `Saved ${batch.length} judgments (${state.results.length} total): ${Object.entries(
    counts,
  )
    .map(([key, values]) => `${key}=${values.length}`)
    .join(', ')}`,
);
