// Whole-deck production check: includes deduplication, concurrency and deadline.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import {
  ModerationService,
  parseModerationOutput,
} from '../src/sharing/moderation.service';
import { moderationTexts } from '../src/sharing/moderation-context';

const fixture = z.object({
  id: z.string(),
  label: z.enum(['safe', 'unsafe']),
  note: z.object({
    id: z.string(),
    cardIds: z.array(z.string()),
    fields: z.record(z.string(), z.string()),
    languages: z.object({
      native: z.string().optional(),
      target: z.string().optional(),
    }),
  }),
  cards: z.array(
    z.object({ id: z.string(), front: z.string(), back: z.string() }),
  ),
});

async function main() {
  const { values } = parseArgs({
    options: {
      corpus: { type: 'string' },
      out: { type: 'string' },
      base: { type: 'string' },
      pool: { type: 'string', default: '8' },
      model: { type: 'string', default: 'qwen3guard-8b:latest' },
      judge: { type: 'string', default: 'gemma4:26b-a4b-it-q4_K_M' },
    },
  });
  if (!values.corpus || !values.out || !values.base)
    throw new Error('Require --corpus --out --base [--pool 1|4|8]');
  const fixtures = (await readFile(values.corpus, 'utf8'))
    .trim()
    .split('\n')
    .map((line) => fixture.parse(JSON.parse(line)));
  const items = moderationTexts(fixtures.map((row) => row.note));
  const observed = new Map<string, { grade: string; judgments: string[] }>();
  let calls = 0,
    judgeCalls = 0,
    active = 0,
    peak = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    const body = JSON.parse(init?.body as string) as {
      model: string;
      messages: { content: string }[];
    };
    const fast = body.model === 'moderation';
    if (fast) {
      body.model = values.model;
      calls++;
    } else judgeCalls++;
    active++;
    peak = Math.max(peak, active);
    try {
      const response = await realFetch(url, {
        ...init,
        body: JSON.stringify(body),
      });
      if (response.ok) {
        const data = (await response.clone().json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const content = data.choices?.[0]?.message?.content ?? '';
        if (fast)
          observed.set(body.messages[0].content, {
            grade:
              parseModerationOutput('qwen3guard', content)?.grade ?? 'error',
            judgments: [],
          });
        else {
          const text = (
            JSON.parse(body.messages[1].content) as { study_content: string }
          ).study_content;
          try {
            observed
              .get(text)
              ?.judgments.push(
                (JSON.parse(content) as { verdict: string }).verdict,
              );
          } catch {
            observed.get(text)?.judgments.push('error');
          }
        }
      }
      return response;
    } finally {
      active--;
    }
  };
  const started = performance.now();
  let result: Awaited<ReturnType<ModerationService['check']>>;
  try {
    result = await new ModerationService(
      new ConfigService({
        AI_API_BASE: values.base,
        AI_API_KEY: process.env.AI_API_KEY ?? '',
        AI_DEFAULT_MODEL: values.judge,
        MODERATION_CONCURRENCY: values.pool,
        MODERATION_ALLOW_ALL: '0',
      }),
    ).check({ deckId: 'benchmark', notes: fixtures.map((row) => row.note) });
  } finally {
    globalThis.fetch = realFetch;
  }
  const wallMs = Math.round(performance.now() - started);
  const rank: Record<string, number> = {
    safe: 0,
    controversial: 1,
    unsafe: 2,
    error: 3,
  };
  const rows = fixtures.map((row) => {
    const relevant = items.filter((item) =>
      item.cardIds.some((id) => row.note.cardIds.includes(id)),
    );
    const grades = relevant.map(
      (item) => observed.get(item.text)?.grade ?? 'error',
    );
    const grade = grades.reduce((a, b) => (rank[a] >= rank[b] ? a : b), 'safe');
    return {
      id: row.id,
      label: row.label,
      grade,
      refused: result.flagged.some((finding) =>
        row.note.cardIds.includes(finding.cardId),
      ),
      downgrades: relevant
        .filter((item) => observed.get(item.text)?.judgments.includes('warn'))
        .map((item) => ({
          textSha256: createHash('sha256').update(item.text).digest('hex'),
          fields: Object.entries(row.note.fields)
            .filter(([, text]) => text === item.text)
            .map(([key]) => key),
        })),
    };
  });
  const summary = {
    pool: Number(values.pool),
    wall_ms: wallMs,
    unique_texts: items.length,
    classifier_calls: calls,
    judge_calls: judgeCalls,
    peak,
    ok: result.ok,
    reason: result.reason,
    errors: result.results.filter((row) => row.verdict === 'error').length,
    grades: Object.fromEntries(
      ['safe', 'unsafe'].map((label) => [
        label,
        Object.fromEntries(
          Object.keys(rank).map((grade) => [
            grade,
            rows.filter((row) => row.label === label && row.grade === grade)
              .length,
          ]),
        ),
      ]),
    ),
    downgrades: rows
      .filter((row) => row.downgrades.length)
      .map((row) => row.id),
  };
  await writeFile(
    values.out,
    JSON.stringify(
      {
        summary,
        rows,
        texts: items.map((item) => ({
          sha256: createHash('sha256').update(item.text).digest('hex'),
          ...observed.get(item.text),
        })),
      },
      null,
      2,
    ) + '\n',
    { flag: 'wx' },
  );
  console.log(JSON.stringify(summary));
  if (summary.errors) process.exitCode = 1;
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
