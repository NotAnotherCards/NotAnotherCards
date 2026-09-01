// Deep audit: judge EVERY open-domain card (no cheap screen), two judges in
// flight. Language topics get a language-teacher prompt that checks
// orthography, accents, articles, and invented words. German source-text
// topics still go through minicheck. Identity of the generating model hidden.
const BASE = 'http://127.0.0.1:11434';
const fs = await import('node:fs');
const OUT = '/tmp/campaign';
const GROUNDED = {
  german:
    'Der Bäcker öffnet seine Backstube jeden Morgen um vier Uhr. Er knetet den Teig, während die Stadt noch schläft. Um sieben Uhr duftet die ganze Straße nach frischem Brot.',
  'de-cloze':
    'Am Wochenende fährt Lena mit dem Zug zu ihrer Großmutter. Sie bringt einen Kuchen mit, den sie am Freitag gebacken hat. Die Großmutter freut sich immer über Besuch und kocht dann Kaffee.',
};
const LANG_TOPICS = new Set([
  'spanish',
  'de-articles',
  'es-ser-estar',
  'de-word-cards',
]);
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
  return (await res.json()).message.content;
}
async function judgeCard(topic, card) {
  if (GROUNDED[topic]) {
    const ans = await chat(
      'bespoke-minicheck:7b',
      `Document: ${GROUNDED[topic]}\nClaim: ${card.front} ${card.back}`,
    );
    return /^\s*yes/i.test(ans)
      ? null
      : { verdict: 'grounding', detail: ans.slice(0, 60) };
  }
  const langExtra = LANG_TOPICS.has(topic)
    ? 'You are a strict language teacher. Also check: correct spelling INCLUDING accents and umlauts, correct articles and plural forms, real words only (no invented words or invented mnemonics), and that the answer teaches the right rule. '
    : '';
  const ans = await chat(
    'qwen3.6:35b',
    `${langExtra}You are verifying a flashcard about "${topic}". First answer the question yourself, then compare with the card's answer.\n` +
      `Question: ${card.front}\nCard's answer: ${card.back}\n` +
      `Is the card factually correct, coherent, and well-formed? Minor wording differences are fine. End with exactly "VERDICT: ok" or "VERDICT: error".`,
    true,
  );
  const m = ans.match(/VERDICT:\s*(ok|error)/i);
  if (!m) return { verdict: 'unparsed' };
  return m[1].toLowerCase() === 'ok'
    ? null
    : { verdict: 'error', judgeTail: ans.slice(-300) };
}
const ids = process.argv.slice(2);
for (const id of ids) {
  const f = `${OUT}/${id}.jsonl`;
  const af = `${OUT}/${id}.audit.json`;
  if (!fs.existsSync(f)) {
    console.log(`${id}: missing`);
    continue;
  }
  if (fs.existsSync(af)) {
    console.log(`${id}: audited, skip`);
    continue;
  }
  const sets = fs
    .readFileSync(f, 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
  const cards = [];
  for (const s of sets)
    if (s.cards && s.parseOk)
      for (const c of s.cards) cards.push({ topic: s.topic, run: s.run, ...c });
  const flags = [];
  let done = 0;
  // two in flight to match OLLAMA_NUM_PARALLEL=2
  const queue = [...cards];
  await Promise.all(
    [1, 2].map(async () => {
      for (;;) {
        const c = queue.shift();
        if (!c) return;
        let judged = false;
        for (let attempt = 1; attempt <= 20 && !judged; attempt++) {
          try {
            const v = await judgeCard(c.topic, c);
            if (v) flags.push({ ...c, ...v });
            judged = true;
          } catch (e) {
            // infrastructure failure (tunnel, ollama restart): wait and retry
            // rather than recording a phantom verdict
            console.log(
              `judge attempt ${attempt} failed (${String(e).slice(0, 60)}), waiting`,
            );
            await new Promise((r) => setTimeout(r, 30000));
          }
        }
        if (!judged) flags.push({ ...c, verdict: 'judge-request-failed' });
        if (++done % 25 === 0)
          console.log(`${id}: ${done}/${cards.length}, flags ${flags.length}`);
      }
    }),
  );
  fs.writeFileSync(af, JSON.stringify(flags, null, 1));
  console.log(`${id}: AUDIT DONE ${cards.length} cards, ${flags.length} flags`);
}
console.log('FULL AUDIT DONE');
