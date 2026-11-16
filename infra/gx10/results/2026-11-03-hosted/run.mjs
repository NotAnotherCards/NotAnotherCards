// Hosted generation campaign (v3). Adapted from
// infra/gx10/results/2026-08-24/driver.mjs and gen-lang.mjs: measures the
// same 10 topics x RUNS_PER_TOPIC per candidate against Groq / OpenRouter
// chat completions instead of the GX10's native /api/chat. Writes one JSONL
// per campaign plus campaign.log in this directory.
//
// Usage (keys are read from GROQ_API_KEY / OPENROUTER_API_KEY and never
// printed):
//   node run.mjs                 # all candidates
//   node run.mjs groq-gpt-oss-120b or-deepseek-chat
import fs from 'node:fs';
import {
  CANDIDATES,
  GROQ_API_BASE,
  OPENROUTER_API_BASE,
  RUNS_PER_TOPIC,
  TOPICS,
  apiKeyFor,
  messagesFor,
} from './config.mjs';
import { THINK_TAG, parseCards } from './lib.mjs';

const dir = new URL('.', import.meta.url).pathname;
const OUT = dir;
const REQUEST_TIMEOUT_MS = Number(process.env.RUN_TIMEOUT_MS ?? 120_000);
const RUN_DELAY_MS = Number(process.env.RUN_DELAY_MS ?? 0);
const MAX_CONSEC_FAILS = 5;
const MAX_ATTEMPTS = 5;
const RETRY_MS = 15_000;

const log = (m) => {
  const line = `[${new Date().toISOString()}] ${m}`;
  console.log(line);
  fs.appendFileSync(`${OUT}campaign.log`, line + '\n');
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function chat(candidate, { messages, reasoningEffort }) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKeyFor(candidate.provider)}`,
  };
  if (candidate.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://notanothercards.com';
    headers['X-Title'] = 'notanothercards-model-report-v3';
  }
  const url = `${candidate.provider === 'groq' ? GROQ_API_BASE : OPENROUTER_API_BASE}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: candidate.model,
      messages,
      temperature: 0.7,
      reasoning_effort: reasoningEffort ?? candidate.reasoningEffort,
      stream: false,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok)
    throw new Error(
      `AI gateway error (${res.status}): ${(await res.text()).slice(0, 200)}`,
    );
  return res.json();
}

// Warm-up plus reasoning_effort probe, excluded from measurements. For
// gpt-oss candidates the probe runs twice (the gateway's 'low' and the
// hard-off 'none') to verify whether the provider honors 'none'.
async function probe(candidate) {
  const probeMessages = [
    { role: 'system', content: 'Reply with only the word ok.' },
    { role: 'user', content: 'Reply with the word ok.' },
  ];
  const variants = candidate.model.includes('gpt-oss')
    ? [candidate.reasoningEffort, 'none']
    : [candidate.reasoningEffort];
  for (const effort of variants) {
    const t0 = Date.now();
    const data = await chat(candidate, {
      messages: probeMessages,
      reasoningEffort: effort,
    });
    const message = data.choices?.[0]?.message ?? {};
    const raw = message.content ?? '';
    const reasoning = message.reasoning_content ?? '';
    log(
      `${candidate.id}: probe reasoning_effort=${effort} wall=${((Date.now() - t0) / 1000).toFixed(2)}s ` +
        `thinkTag=${THINK_TAG.test(raw)} reasoningContent=${reasoning.length} ` +
        `completionTokens=${data.usage?.completion_tokens ?? 'n/a'}`,
    );
  }
}

const ids = process.argv.slice(2);
const chosen = ids.length
  ? CANDIDATES.filter((c) => ids.includes(c.id))
  : CANDIDATES;
if (ids.length && chosen.length !== ids.length)
  throw new Error(`unknown candidate id in: ${ids.join(', ')}`);

for (const candidate of chosen) {
  if (!apiKeyFor(candidate.provider)) {
    log(`${candidate.id}: missing key for ${candidate.provider}, skipping`);
    continue;
  }
  const id = candidate.id;
  const outFile = `${OUT}${id}.jsonl`;
  const expected = TOPICS.length * RUNS_PER_TOPIC;
  if (
    fs.existsSync(outFile) &&
    fs.readFileSync(outFile, 'utf8').trim().split('\n').filter(Boolean)
      .length >= expected
  ) {
    log(`${id}: already complete, skipping`);
    continue;
  }
  log(`${id}: start ${candidate.model} via ${candidate.provider}`);
  await probe(candidate);

  let consecFail = 0;
  for (const topic of TOPICS) {
    for (let run = 1; run <= RUNS_PER_TOPIC; run++) {
      const rec = {
        campaign: id,
        provider: candidate.provider,
        requestedModel: candidate.model,
        reasoningEffort: candidate.reasoningEffort,
        topic: topic.id,
        suite: topic.suite,
        run,
        ts: new Date().toISOString(),
      };
      const t0 = Date.now();
      let wrote = false;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS && !wrote; attempt++) {
        try {
          const data = await chat(candidate, { messages: messagesFor(topic) });
          rec.seconds = (Date.now() - t0) / 1000;
          rec.servedModel = data.model ?? candidate.model;
          rec.usage = {
            promptTokens: data.usage?.prompt_tokens ?? 0,
            completionTokens: data.usage?.completion_tokens ?? 0,
            totalTokens: data.usage?.total_tokens ?? 0,
          };
          rec.raw = data.choices?.[0]?.message?.content ?? '';
          rec.thinkTag = THINK_TAG.test(rec.raw);
          try {
            rec.cards = parseCards(rec.raw);
            rec.parseOk =
              Array.isArray(rec.cards) &&
              rec.cards.every(
                (x) =>
                  x !== null &&
                  typeof x.front === 'string' &&
                  typeof x.back === 'string',
              );
          } catch (e) {
            rec.parseOk = false;
            rec.parseError = String(e).slice(0, 150);
          }
          consecFail = 0;
          wrote = true;
        } catch (e) {
          rec.error = String(e).slice(0, 200);
          rec.seconds = (Date.now() - t0) / 1000;
          const retryable =
            /\((429|5\d\d)\)/.test(rec.error) || e instanceof TypeError;
          if (!retryable || attempt >= MAX_ATTEMPTS) {
            if (++consecFail >= MAX_CONSEC_FAILS) {
              log(
                `${id}: ${consecFail} consecutive failures, aborting campaign`,
              );
            }
            break;
          }
          log(`${id}: ${rec.error.slice(0, 80)}, retry ${attempt} in 15s`);
          await sleep(RETRY_MS);
        }
      }
      fs.appendFileSync(outFile, JSON.stringify(rec) + '\n');
      if (consecFail >= MAX_CONSEC_FAILS) break;
      if (RUN_DELAY_MS) await sleep(RUN_DELAY_MS);
    }
    if (consecFail >= MAX_CONSEC_FAILS) break;
    log(`${id}: ${topic.id} done`);
  }
  log(`${id}: campaign complete`);
}
log('ALL CAMPAIGNS DONE');
