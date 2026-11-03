// v3 summary: aggregates each candidate's generated JSONL, audit flags and
// judge usage this directory into summary.json and a paste-ready
// summary.md table (parse rate, adjudicated issue rate, median seconds per
// five-card set, tokens per set, cents per set). Adapted from
// 2026-08-24/adjudication/summarize.mjs's median/reduction logic.
//
//   node summarize.mjs
import fs from 'node:fs';
import { CANDIDATES, JUDGE } from './config.mjs';

const dir = new URL('.', import.meta.url).pathname;

function median(values) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}
const readJsonl = (f) =>
  fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);

const candidates = CANDIDATES.filter((c) =>
  fs.existsSync(`${dir}${c.id}.jsonl`),
);
if (candidates.length === 0) throw new Error('no generated campaigns found');

const rows = [];
for (const candidate of candidates) {
  const sets = readJsonl(`${dir}${candidate.id}.jsonl`);
  const measured = sets.filter(
    (s) => s.ts && (s.parseOk !== undefined || s.error),
  );
  const parsed = sets.filter((s) => s.parseOk);
  const cards = parsed.reduce((n, s) => n + (s.cards?.length ?? 0), 0);
  const generalSeconds = parsed
    .filter((s) => s.suite === 'general')
    .map((s) => s.seconds);
  const languageSeconds = parsed
    .filter((s) => s.suite === 'language')
    .map((s) => s.seconds);
  const tokensPerSet = parsed.map((s) => s.usage?.totalTokens ?? 0);
  const centsPerSet = parsed.map(
    (s) =>
      (((s.usage?.promptTokens ?? 0) * candidate.usd.in +
        (s.usage?.completionTokens ?? 0) * candidate.usd.out) /
        1e6) *
      100,
  );
  const thinkTags = sets.filter((s) => s.thinkTag).length;
  let flags = null;
  let judge = null;
  if (fs.existsSync(`${dir}${candidate.id}.audit.json`)) {
    flags = JSON.parse(
      fs.readFileSync(`${dir}${candidate.id}.audit.json`, 'utf8'),
    );
    const issues = flags.filter((f) => f.verdict === 'error').length;
    judge = {
      file: `${candidate.id}.audit.json`,
      flagged: flags.length,
      unparsedVerdicts: flags.filter((f) => f.verdict === 'unparsed').length,
      judgeRequestFailed: flags.filter(
        (f) => f.verdict === 'judge-request-failed',
      ).length,
      issues,
      issueRate: cards ? issues / cards : null,
    };
  }
  if (fs.existsSync(`${dir}${candidate.id}.judge.json`)) {
    const j = JSON.parse(
      fs.readFileSync(`${dir}${candidate.id}.judge.json`, 'utf8'),
    );
    judge = {
      ...judge,
      judgeTokens: j.totalTokens,
      judgeCents:
        ((j.promptTokens * JUDGE.usd.in + j.completionTokens * JUDGE.usd.out) /
          1e6) *
        100,
    };
  }
  rows.push({
    campaign: candidate.id,
    model: candidate.model,
    provider: candidate.provider,
    usd: candidate.usd,
    sets,
    measured: measured.length,
    parseRate: `${parsed.length}/${sets.filter((s) => s.ts && !s.error).length || sets.length}`,
    cards,
    medianGeneralSeconds: median(generalSeconds),
    medianLanguageSeconds: median(languageSeconds),
    medianSeconds: median(parsed.map((s) => s.seconds)),
    medianTokensPerSet: median(tokensPerSet),
    totalTokens: tokensPerSet.reduce((a, b) => a + b, 0),
    medianCentsPerSet: median(centsPerSet),
    campaignCents: centsPerSet.reduce((a, b) => a + b, 0),
    thinkTagged: thinkTags,
    thinkTagRate: sets.length ? thinkTags / sets.length : null,
    servedModelMismatch: parsed.filter((s) => s.servedModel !== candidate.model)
      .length,
    ...judge,
  });
}

const sorted = rows.sort((a, b) =>
  a.medianSeconds === b.medianSeconds
    ? (a.issueRate ?? 1) - (b.issueRate ?? 1)
    : a.medianSeconds - b.medianSeconds,
);

const summary = {
  judge: JUDGE,
  candidates,
  results: sorted,
  generatedAt: new Date().toISOString(),
};
fs.writeFileSync(`${dir}summary.json`, `${JSON.stringify(summary, null, 1)}\n`);

const pct = (n) => (n === null ? 'n/a' : `${(n * 100).toFixed(1)}%`);
const fmt = (n, d = 2) => (n === null ? 'n/a' : n.toFixed(d));
const md = [
  '| model | format | cards | general median | language median | tokens/set | cents/set | issues | issue rate |',
  '| --------------------------------------- | -----: | ----: | -------------: | --------------: | ---------: | --------: | -----: | ---------: |',
  ...sorted.map(
    (r) =>
      `| \`${r.model}\` · ${r.provider} | ${r.parseRate} | ${r.cards} | ` +
      `${fmt(r.medianGeneralSeconds)} s | ${fmt(r.medianLanguageSeconds)} s | ` +
      `${fmt(r.medianTokensPerSet, 0)} | ${fmt(r.medianCentsPerSet, 3)} | ` +
      `${r.issues ?? 'n/a'} | ${pct(r.issueRate ?? null)} |`,
  ),
];
fs.writeFileSync(
  `${dir}summary.md`,
  `${md.join('\n')}\n\nGenerated via \`node summarize.mjs\` at ${summary.generatedAt}\n`,
);
console.log(md.join('\n'));
console.log(
  `\nWrote summary.json and summary.md for ${sorted.length} candidates; paste the table into docs/model-report-v3.md.`,
);
