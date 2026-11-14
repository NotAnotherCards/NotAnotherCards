// Card-quality audit (v3). Adapted from infra/gx10/results/2026-08-24/
// audit.mjs: judges EVERY parsed card instead of the local qwen/MiniCheck
// pair (the GX10 judges are gone), with one strong hosted judge called by
// its ordinary model alias (no reasoning-parameter probing). Written flags
// use the same shape as v2: {campaign, topic, run, ...card, verdict,
// judgeTail}.
//
// Usage (judge key comes from OPENROUTER_API_KEY):
//   node audit.mjs               # audit every generated campaign jsonl
//   node audit.mjs groq-gpt-oss-20b
import fs from 'node:fs';
import {
  GROQ_API_BASE,
  JUDGE,
  OPENROUTER_API_BASE,
  CANDIDATES,
  TOPICS,
  apiKeyFor,
} from './config.mjs';

const dir = new URL('.', import.meta.url).pathname;
const JUDGE_TIMEOUT_MS = Number(process.env.AUDIT_TIMEOUT_MS ?? 120_000);
const RETRY_MS = 30_000;
const WORKERS = 2;

const log = (m) => console.log(`[${new Date().toISOString()}] ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const baseFor = (provider) =>
  provider === 'groq' ? GROQ_API_BASE : OPENROUTER_API_BASE;

async function judgeCard(candidate, topic, card) {
  const langExtra =
    topic.suite === 'language'
      ? 'You are a strict language teacher. Also check: correct spelling INCLUDING accents and umlauts, correct articles and plural forms, real words only (no invented words or invented mnemonics), and that the answer teaches the right rule. '
      : '';
  const sourceText = topic.sourceText
    ? `The card is grounded in this source text, so check that it teaches only what the text supports: "${topic.sourceText}"\n`
    : '';
  const messages = [
    {
      role: 'user',
      content:
        `${langExtra}${sourceText}` +
        `You are verifying a flashcard about "${topic.id}". First answer the question yourself, then compare with the card's answer.\n` +
        `Question: ${card.front}\nCard's answer: ${card.back}\n` +
        `Is the card factually correct, coherent, and well-formed? Minor wording differences are fine. End with exactly "VERDICT: ok" or "VERDICT: error".`,
    },
  ];
  const res = await fetch(`${baseFor(JUDGE.provider)}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKeyFor(JUDGE.provider)}`,
      ...(JUDGE.provider === 'openrouter' && {
        'HTTP-Referer': 'https://notanothercards.com',
        'X-Title': 'notanothercards-model-report-v3',
      }),
    },
    body: JSON.stringify({
      model: JUDGE.model,
      messages,
      temperature: 0,
      reasoning_effort: JUDGE.reasoningEffort,
      stream: false,
    }),
    signal: AbortSignal.timeout(JUDGE_TIMEOUT_MS),
  });
  if (!res.ok)
    throw new Error(
      `judge error (${res.status}): ${(await res.text()).slice(0, 120)}`,
    );
  const data = await res.json();
  const usage = data.usage ?? {};
  const ans = data.choices?.[0]?.message?.content ?? '';
  candidate.judgeTokens.totalTokens += usage.total_tokens ?? 0;
  candidate.judgeTokens.promptTokens =
    (candidate.judgeTokens.promptTokens ?? 0) + (usage.prompt_tokens ?? 0);
  candidate.judgeTokens.completionTokens =
    (candidate.judgeTokens.completionTokens ?? 0) +
    (usage.completion_tokens ?? 0);
  candidate.judgeTokens.calls += 1;
  const m = ans.match(/VERDICT:\s*(ok|error)/i);
  if (!m) return { verdict: 'unparsed', judgeTail: ans.slice(-300) };
  return m[1].toLowerCase() === 'ok'
    ? null
    : { verdict: 'error', judgeTail: ans.slice(-300) };
}

const ids = process.argv.slice(2);
const campaigns = CANDIDATES.filter(
  (c) =>
    fs.existsSync(`${dir}${c.id}.jsonl`) &&
    (ids.length === 0 || ids.includes(c.id)),
);
if (ids.length && campaigns.length !== ids.length)
  throw new Error(
    `requested campaign(s) have no generated jsonl: ${ids.join(', ')}`,
  );

for (const candidate of campaigns) {
  if (!apiKeyFor(JUDGE.provider)) {
    log(`${candidate.id}: missing OPENROUTER_API_KEY, skipping audit`);
    continue;
  }
  candidate.judgeTokens = {
    calls: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  const af = `${dir}${candidate.id}.audit.json`;
  if (fs.existsSync(af)) {
    log(`${candidate.id}: audited, skip`);
    continue;
  }
  const sets = fs
    .readFileSync(`${dir}${candidate.id}.jsonl`, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const cards = [];
  for (const s of sets)
    if (s.cards && s.parseOk)
      for (const c of s.cards) cards.push({ topic: s.topic, run: s.run, ...c });
  log(`${candidate.id}: ${cards.length} parsed cards to judge`);
  const flags = [];
  let done = 0;
  const queue = [...cards];
  await Promise.all(
    Array.from({ length: WORKERS }, async () => {
      for (;;) {
        const c = queue.shift();
        if (!c) return;
        let judged = false;
        for (let attempt = 1; attempt <= 20 && !judged; attempt++) {
          try {
            const topic = TOPICS.find((t) => t.id === c.topic);
            const v = await judgeCard(candidate, topic, c);
            if (v) flags.push({ ...c, ...v });
            judged = true;
          } catch (e) {
            // hosted-judge infra failure: retry rather than record a phantom
            // verdict
            log(
              `${candidate.id}: judge attempt ${attempt} failed (${String(e).slice(0, 60)}), waiting`,
            );
            await sleep(RETRY_MS);
          }
        }
        if (!judged) flags.push({ ...c, verdict: 'judge-request-failed' });
        if (++done % 25 === 0)
          log(
            `${candidate.id}: ${done}/${cards.length}, flags ${flags.length}`,
          );
      }
    }),
  );
  fs.writeFileSync(af, JSON.stringify(flags, null, 1));
  fs.writeFileSync(
    `${dir}${candidate.id}.judge.json`,
    JSON.stringify({ model: JUDGE.model, ...candidate.judgeTokens }, null, 2) +
      '\n',
  );
  log(
    `${candidate.id}: AUDIT DONE ${cards.length} cards, ${flags.length} flags, judge tokens ${candidate.judgeTokens.totalTokens}`,
  );
}
log('FULL AUDIT DONE');
