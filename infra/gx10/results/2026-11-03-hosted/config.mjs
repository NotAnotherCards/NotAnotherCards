// Shared configuration for the hosted model campaign (v3): Groq primary,
// OpenRouter fallback. Adapts the GX10 audit drivers
// (infra/gx10/results/2026-08-24/{driver,gen-lang,audit}.mjs), whose local
// judges ran on the decommissioned GX10. Prompts mirror the production
// gateway (apps/api/src/ai/prompts/*.v1.ts) so results reflect what the
// worker actually issues per job.
export const GROQ_API_BASE = 'https://api.groq.com/openai/v1';
export const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

/** Reads the key for a provider from the environment; never logs the value. */
export function apiKeyFor(provider) {
  return provider === 'groq'
    ? process.env.GROQ_API_KEY
    : process.env.OPENROUTER_API_KEY;
}

// Candidates. EDIT THIS LIST before the real run; acceptance needs at least
// 3 Groq and 2 OpenRouter models. `usd` is price per 1M tokens:
// the values below carry over from the ADR cost table or public rate cards
// and MUST be re-verified against the provider pricing pages when keys are
// procured (Groq: console.groq.com, OpenRouter: openrouter.ai/models).
// `reasoningEffort` mirrors the gateway's mapping (low for gpt-oss, none
// otherwise) so timing includes the same reasoning tokens production pays.
export const CANDIDATES = [
  {
    id: 'groq-gpt-oss-120b',
    provider: 'groq',
    model: 'openai/gpt-oss-120b',
    reasoningEffort: 'low',
    usd: { in: 0.15, out: 0.6 },
  },
  {
    id: 'groq-gpt-oss-20b',
    provider: 'groq',
    model: 'openai/gpt-oss-20b',
    reasoningEffort: 'low',
    usd: { in: 0.075, out: 0.3 },
  },
  {
    id: 'groq-llama-3.3-70b',
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    reasoningEffort: 'none',
    usd: { in: 0.59, out: 0.79 },
  },
  {
    id: 'or-qwen3.8-27b',
    provider: 'openrouter',
    model: 'qwen/qwen3.8-27b',
    reasoningEffort: 'none',
    usd: { in: 0.8, out: 4.0 },
  },
  {
    id: 'or-deepseek-chat',
    provider: 'openrouter',
    model: 'deepseek/deepseek-chat',
    reasoningEffort: 'none',
    usd: { in: 0.27, out: 1.1 },
  },
];

// Card-quality judges. One hosted stage replaces the v2 three-stage review
// (local qwen judge + MiniCheck on the GX10, Opus full pass, Fable
// escalation): the GX10 judges are gone and a single hosted judge keeps the
// campaign fully scriptable. Swap the model here before the run; judge cost
// is metered separately in <candidate>.judge.json.
export const JUDGE = {
  provider: 'openrouter',
  model: 'deepseek/deepseek-chat',
  reasoningEffort: 'none',
  usd: { in: 0.27, out: 1.1 },
};

// Production prompts (verbatim from apps/api/src/ai/prompts/*.v1.ts).
export const TOPIC_SYSTEM =
  'You generate flashcards for a spaced-repetition app. ' +
  'Reply with ONLY a valid JSON array of objects. Each object must have exactly two fields: ' +
  '{"front": string, "back": string}. Front is a concise question or prompt, back is the direct answer. ' +
  'Keep each side under 20 words. Markdown formatting is supported in front and back fields.';

export const TEXT_SYSTEM =
  'You generate flashcards for a spaced-repetition app from source text. ' +
  'Reply with ONLY a valid JSON array of objects: [{"front": string, "back": string}]. ' +
  'Keep each side under 20 words. Markdown formatting is supported in front and back fields.';

const GERMAN_TEXT =
  'Der Bäcker öffnet seine Backstube jeden Morgen um vier Uhr. Er knetet den Teig, während die Stadt noch schläft. Um sieben Uhr duftet die ganze Straße nach frischem Brot.';
const CLOZE_TEXT =
  'Am Wochenende fährt Lena mit dem Zug zu ihrer Großmutter. Sie bringt einen Kuchen mit, den sie am Freitag gebacken hat. Die Großmutter freut sich immer über Besuch und kocht dann Kaffee.';

// Topic set mirrors model-report-v2 (6 general + 4 language topics, 5 runs
// each) for comparability. Source-text topics request 4 cards like in the app
// (TEXT_GENERATION_V1.buildUserPrompt defaults to 4).
export const TOPICS = [
  {
    id: 'spanish',
    suite: 'general',
    user: `Create 5 flashcards for the topic: "Spanish preterite tense for beginners".`,
  },
  {
    id: 'biology',
    suite: 'general',
    user: `Create 5 flashcards for the topic: "photosynthesis, for a high school biology student".`,
  },
  {
    id: 'german',
    suite: 'general',
    sourceText: GERMAN_TEXT,
    user: `From the text below, create 4 comprehension flashcards:\n\n"${GERMAN_TEXT}"`,
  },
  {
    id: 'history',
    suite: 'general',
    user: `Create 5 flashcards for the topic: "key events of the French Revolution with dates".`,
  },
  {
    id: 'programming',
    suite: 'general',
    user: `Create 5 flashcards for the topic: "JavaScript array methods (map, filter, reduce)".`,
  },
  {
    id: 'music',
    suite: 'general',
    user: `Create 5 flashcards for the topic: "music intervals for beginners (thirds, fifths, octaves)".`,
  },
  {
    id: 'de-articles',
    suite: 'language',
    user: `Create 5 flashcards for the topic: "German A2 nouns: front is the noun without article (e.g. \\"Tisch\\"), back is definite article and plural (e.g. \\"der Tisch, die Tische\\"). Use common household nouns."`,
  },
  {
    id: 'es-ser-estar',
    suite: 'language',
    user: `Create 5 flashcards for the topic: "teaching when Spanish uses ser vs estar: front is a Spanish sentence with a blank for the verb, back is the correct conjugated form and one word saying why (e.g. \\"está - location\\")."`,
  },
  {
    id: 'de-word-cards',
    suite: 'language',
    user: `Create 5 flashcards for the topic: "German-to-English word cards for B1 verbs: front is the German verb with one short German example sentence, back is the English translation."`,
  },
  {
    id: 'de-cloze',
    suite: 'language',
    sourceText: CLOZE_TEXT,
    user: `From the text below, create 4 cloze flashcards: front is a sentence from the text with one word replaced by ___, back is the missing word:\n\n"${CLOZE_TEXT}"`,
  },
];

export const RUNS_PER_TOPIC = 5;

/** The production system prompt is server prompt-shape; source-text topics
 * use TEXT_GENERATION_V1, open-domain topics TOPIC_GENERATION_V1. */
export function messagesFor(topic) {
  return [
    { role: 'system', content: topic.sourceText ? TEXT_SYSTEM : TOPIC_SYSTEM },
    { role: 'user', content: topic.user },
  ];
}
