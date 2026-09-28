// Run locally against the gateway, or a tunnel to Ollama's /v1 endpoint.
// tsx scripts/moderation-bench.ts --mode publish --corpus inputs.jsonl --out results.jsonl
import { open, readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import {
  ModerationService,
  parseModerationOutput,
} from '../src/sharing/moderation.service';

const itemSchema = z.object({
  id: z.string(),
  label: z.enum(['safe', 'unsafe']),
  text: z.string(),
});
const completionSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string() }) }))
    .min(1),
});

async function main() {
  const { values } = parseArgs({
    options: {
      mode: { type: 'string', default: 'publish' },
      corpus: { type: 'string' },
      out: { type: 'string' },
      base: { type: 'string', default: process.env.AI_API_BASE },
      model: { type: 'string', default: 'moderation' },
      'judge-model': {
        type: 'string',
        default: process.env.AI_DEFAULT_MODEL ?? 'gemma4',
      },
    },
  });
  if (
    !values.corpus ||
    !values.out ||
    !values.base ||
    !['raw', 'publish', 'judge'].includes(values.mode)
  ) {
    throw new Error(
      'usage: moderation-bench.ts --mode raw|publish|judge --corpus <jsonl> --out <new-jsonl> --base <url/v1> [--model moderation] [--judge-model gemma4]',
    );
  }
  const base = values.base.replace(/\/+$/, '');
  const model = values.model;
  const judgeModel = values['judge-model'];
  const items = (await readFile(values.corpus, 'utf8'))
    .split('\n')
    .filter(Boolean)
    .map((line) => itemSchema.parse(JSON.parse(line)));
  const output = await open(values.out, 'wx');
  const realFetch = globalThis.fetch;
  // Expand the fast alias only for a direct Ollama benchmark. The publish
  // path otherwise executes the production code, policy, parser and budgets.
  globalThis.fetch = (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(init?.body as string) as { model: string };
    if (values.mode === 'judge' && body.model === 'moderation') {
      // Isolate injection resistance even when the fast model would not flag
      // an item. The production judge request, parser and deadline stay real.
      return Promise.resolve(
        Response.json({
          choices: [
            {
              message: {
                content: 'Safety: Unsafe\nCategories: Unethical Acts',
              },
            },
          ],
        }),
      );
    }
    if (body.model === 'moderation') body.model = model;
    return realFetch(url, { ...init, body: JSON.stringify(body) });
  };
  const service = new ModerationService(
    new ConfigService({
      AI_API_BASE: base,
      AI_API_KEY: process.env.AI_API_KEY ?? '',
      AI_DEFAULT_MODEL: judgeModel,
      MODERATION_ALLOW_ALL: '0',
    }),
  );
  let tp = 0,
    fp = 0,
    fn = 0,
    tn = 0,
    errors = 0,
    judgeErrors = 0;
  let judgeCalls = 0,
    refusedUnsafe = 0,
    refusedSafe = 0,
    downgradedUnsafe = 0;
  const latencies: number[] = [];
  try {
    for (const [index, item] of items.entries()) {
      const start = performance.now();
      let verdict: string | undefined;
      let flag: boolean | null = null;
      let refused = true;
      let judge: string | null = null;
      let error: string | undefined;
      try {
        if (values.mode === 'raw') {
          const response = await realFetch(`${base}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(process.env.AI_API_KEY
                ? { Authorization: `Bearer ${process.env.AI_API_KEY}` }
                : {}),
            },
            body: JSON.stringify({
              model,
              temperature: 0,
              stream: false,
              messages: [{ role: 'user', content: item.text }],
            }),
            signal: AbortSignal.timeout(30_000),
          });
          if (!response.ok) throw new Error(`gateway HTTP ${response.status}`);
          const body = completionSchema.parse(await response.json());
          const parsed = parseModerationOutput(
            'qwen3guard',
            body.choices[0].message.content,
          );
          if (!parsed) throw new Error('unparseable verdict');
          verdict = parsed.grade;
          refused = verdict === 'unsafe';
          flag = verdict !== 'safe';
        } else {
          const result = await service.check({
            deckId: item.id,
            notes: [{ id: item.id, cardIds: [item.id], text: item.text }],
          });
          const fast = result.results[0];
          verdict = fast?.verdict;
          if (!fast || fast.verdict === 'error')
            throw new Error(fast?.error ?? 'missing fast verdict');
          refused = !result.ok;
          flag = result.flagged.length > 0 || result.warnings.length > 0;
          const opinion = result.results[1];
          if (opinion) {
            judgeCalls++;
            judge =
              opinion.verdict === 'error'
                ? 'error'
                : opinion.verdict === 'controversial'
                  ? 'warn'
                  : 'confirm';
            if (judge === 'error') judgeErrors++;
          }
        }
      } catch (cause) {
        errors++;
        error = cause instanceof Error ? cause.message : 'request failed';
      }
      const ms = Math.round(performance.now() - start);
      latencies.push(ms);
      if (flag !== null) {
        if (item.label === 'unsafe') {
          if (flag) tp++;
          else fn++;
        } else {
          if (flag) fp++;
          else tn++;
        }
        if (refused) {
          if (item.label === 'unsafe') refusedUnsafe++;
          else refusedSafe++;
        }
        if (item.label === 'unsafe' && judge === 'warn') downgradedUnsafe++;
      }
      // IDs and verdicts only: never persist corpus text or model quotations.
      await output.write(
        `${JSON.stringify({ id: item.id, label: item.label, flag, verdict, refused, judge, error, ms })}\n`,
      );
      if ((index + 1) % 25 === 0) console.error(`${index + 1}/${items.length}`);
    }
  } finally {
    globalThis.fetch = realFetch;
    await output.close();
  }
  latencies.sort((a, b) => a - b);
  const percentile = (p: number) =>
    latencies[
      Math.min(latencies.length - 1, Math.floor(latencies.length * p))
    ] ?? null;
  console.log(
    JSON.stringify({
      mode: values.mode,
      model,
      judge_model: values.mode !== 'raw' ? judgeModel : null,
      items: items.length,
      unsafe: tp + fn,
      safe: fp + tn,
      recall: tp + fn ? tp / (tp + fn) : null,
      precision: tp + fp ? tp / (tp + fp) : null,
      fpr: fp + tn ? fp / (fp + tn) : null,
      errors,
      judge_errors: judgeErrors,
      judge_calls: judgeCalls,
      refused_unsafe: refusedUnsafe,
      refused_safe: refusedSafe,
      downgraded_unsafe: downgradedUnsafe,
      p50_ms: percentile(0.5),
      p95_ms: percentile(0.95),
    }),
  );
  if (errors || judgeErrors) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Benchmark failed');
  process.exitCode = 1;
});
