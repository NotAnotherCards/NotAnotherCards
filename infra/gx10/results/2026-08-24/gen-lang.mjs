// Language-learning generation extension: 4 topics x 5 runs per model.
const BASE = 'http://127.0.0.1:11434';
const fs = await import('node:fs');
const OUT = '/tmp/campaign';
const FORMAT =
  'Reply with only a JSON array, each element {"front": string, "back": string}. ' +
  'Front is a question or prompt, back is the answer. Keep each side under 20 words.';
const CLOZE_TEXT =
  'Am Wochenende fährt Lena mit dem Zug zu ihrer Großmutter. Sie bringt ' +
  'einen Kuchen mit, den sie am Freitag gebacken hat. Die Großmutter freut ' +
  'sich immer über Besuch und kocht dann Kaffee.';
const PROMPTS = {
  'de-articles':
    'You generate flashcards for a spaced-repetition language app. Create 5 flashcards for German A2 nouns. Front: the noun without article (e.g. "Tisch"). Back: definite article and plural (e.g. "der Tisch, die Tische"). Use common household nouns. ' +
    FORMAT,
  'es-ser-estar':
    'You generate flashcards for a spaced-repetition language app. Create 5 flashcards teaching when Spanish uses ser vs estar. Front: a Spanish sentence with a blank for the verb. Back: the correct conjugated form and one word saying why (e.g. "está - location"). ' +
    FORMAT,
  'de-word-cards':
    'You generate flashcards for a spaced-repetition language app. Create 5 German-to-English word cards for B1 verbs. Front: the German verb with one short German example sentence. Back: the English translation. ' +
    FORMAT,
  'de-cloze':
    'You generate flashcards for a spaced-repetition language app. From the German text below, create 4 cloze cards for an A2 learner: front is a sentence from the text with one word replaced by ___, back is the missing word. Text: "' +
    CLOZE_TEXT +
    '" ' +
    FORMAT,
};
const MODELS = [
  ['qwen3.6-lang', 'qwen3.6:35b'],
  ['qwen3.8-lang', 'qwen3.8:27b'],
  ['gemma4-lang', 'gemma4:26b-a4b-it-q4_K_M'],
  ['nemotron-lang', 'nemotron-3.5-lightning:30b-a3b-q4_K_M'],
  ['ornith-lang', 'ornith-1.5:35b'],
  ['laguna-lang', 'laguna-xs-2.1:q4_K_M'],
  ['muse-glimmer-lang', 'muse-glimmer:30b-q4_K_M'],
];
const log = (m) => {
  const l = `[${new Date().toISOString()}] ${m}`;
  console.log(l);
  fs.appendFileSync(`${OUT}/campaign.log`, l + '\n');
};
async function chat(model, content, think) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
      ...(think !== undefined && { think }),
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return await res.json();
}
for (const [id, model] of MODELS) {
  const out = `${OUT}/${id}.jsonl`;
  if (
    fs.existsSync(out) &&
    fs.readFileSync(out, 'utf8').trim().split('\n').length >= 20
  ) {
    log(`${id}: complete, skip`);
    continue;
  }
  const show =
    (await chat) === null
      ? null
      : await (
          await fetch(`${BASE}/api/show`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model }),
          })
        ).json();
  const thinking = (show.capabilities ?? []).includes('thinking');
  await chat(model, 'Reply with the word ok.', thinking ? false : undefined); // warm
  for (const [topic, prompt] of Object.entries(PROMPTS)) {
    for (let run = 1; run <= 5; run++) {
      const rec = {
        campaign: id,
        model,
        topic,
        run,
        ts: new Date().toISOString(),
      };
      const t0 = Date.now();
      try {
        const j = await chat(model, prompt, thinking ? false : undefined);
        rec.seconds = (Date.now() - t0) / 1000;
        rec.raw = j.message.content;
        rec.reasoningChars = (j.message.thinking ?? '').length;
        rec.answerTokens = j.eval_count;
        try {
          const cards = JSON.parse(
            rec.raw.slice(rec.raw.indexOf('['), rec.raw.lastIndexOf(']') + 1),
          );
          rec.cards = cards;
          rec.parseOk =
            Array.isArray(cards) &&
            cards.every(
              (x) =>
                typeof x.front === 'string' &&
                typeof x.back === 'string' &&
                Object.keys(x).length === 2,
            );
        } catch {
          rec.parseOk = false;
        }
      } catch (e) {
        rec.error = String(e).slice(0, 150);
      }
      fs.appendFileSync(out, JSON.stringify(rec) + '\n');
    }
  }
  log(`${id}: lang generation complete`);
}
log('LANG GENERATION DONE');
