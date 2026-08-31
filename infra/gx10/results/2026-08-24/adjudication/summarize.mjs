import fs from 'node:fs';

const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '');
const opus = JSON.parse(
  fs.readFileSync(`${ROOT}/opus-adjudication.json`, 'utf8'),
);
const fable = JSON.parse(
  fs.readFileSync(`${ROOT}/adjudication/fable.json`, 'utf8'),
);
const reviewIds = new Set(
  opus.results
    .filter((result) => result.opusVerdict !== 'ok' || result.qwenFlag)
    .map((result) => result.id),
);
const fableById = new Map(fable.results.map((result) => [result.id, result]));

if (
  fableById.size !== reviewIds.size ||
  [...reviewIds].some((id) => !fableById.has(id))
) {
  throw new Error(
    `Fable adjudication is incomplete: ${fableById.size}/${reviewIds.size}`,
  );
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function increment(object, key) {
  object[key] = (object[key] ?? 0) + 1;
}

const campaigns = [
  ...new Set(opus.results.map((result) => result.campaign)),
].sort();
const campaignData = new Map();
const modelData = new Map();

for (const campaign of campaigns) {
  const sets = fs
    .readFileSync(`${ROOT}/${campaign}.jsonl`, 'utf8')
    .trim()
    .split('\n')
    .map(JSON.parse);
  const firstWithMetadata = sets.find((set) => set.family) ?? sets[0];
  const model = sets[0].model;
  const data = {
    campaign,
    model,
    suite: campaign.endsWith('-lang') ? 'language' : 'general',
    family: firstWithMetadata.family ?? null,
    quantization: firstWithMetadata.quant ?? null,
    parameters: firstWithMetadata.params ?? null,
    sets: sets.length,
    formatOk: sets.filter((set) => set.parseOk).length,
    cards: sets
      .filter((set) => set.parseOk)
      .reduce((total, set) => total + (set.cards?.length ?? 0), 0),
    latencies: sets.map((set) => set.seconds).filter(Number.isFinite),
    decodeRates: sets.map((set) => set.decodeTokS).filter(Number.isFinite),
    dispositions: {},
    topics: {},
    qwenFlags: 0,
    opusVerdicts: {},
  };
  campaignData.set(campaign, data);

  if (!modelData.has(model)) {
    modelData.set(model, {
      model,
      family: data.family,
      quantization: data.quantization,
      parameters: data.parameters,
      campaigns: [],
      sets: 0,
      formatOk: 0,
      cards: 0,
      generalLatencies: [],
      languageLatencies: [],
      decodeRates: [],
      dispositions: {},
      topics: {},
      qwenFlags: 0,
      opusVerdicts: {},
    });
  }
  const modelEntry = modelData.get(model);
  modelEntry.family ??= data.family;
  modelEntry.quantization ??= data.quantization;
  modelEntry.parameters ??= data.parameters;
  modelEntry.campaigns.push(campaign);
  modelEntry.sets += data.sets;
  modelEntry.formatOk += data.formatOk;
  modelEntry.cards += data.cards;
  modelEntry[`${data.suite}Latencies`].push(...data.latencies);
  modelEntry.decodeRates.push(...data.decodeRates);
}

for (const result of opus.results) {
  const campaign = campaignData.get(result.campaign);
  const model = modelData.get(campaign.model);
  const disposition = fableById.get(result.id)?.disposition ?? 'accepted';

  increment(campaign.dispositions, disposition);
  increment(model.dispositions, disposition);
  increment(campaign.opusVerdicts, result.opusVerdict);
  increment(model.opusVerdicts, result.opusVerdict);
  if (result.qwenFlag) {
    campaign.qwenFlags++;
    model.qwenFlags++;
  }

  campaign.topics[result.topic] ??= {
    cards: 0,
    qwenFlags: 0,
    opusVerdicts: {},
    dispositions: {},
  };
  model.topics[result.topic] ??= {
    cards: 0,
    qwenFlags: 0,
    opusVerdicts: {},
    dispositions: {},
  };
  for (const topic of [
    campaign.topics[result.topic],
    model.topics[result.topic],
  ]) {
    topic.cards++;
    if (result.qwenFlag) topic.qwenFlags++;
    increment(topic.opusVerdicts, result.opusVerdict);
    increment(topic.dispositions, disposition);
  }
}

function finalize(entry) {
  const output = { ...entry };
  const generalLatencies =
    entry.generalLatencies ??
    (entry.suite === 'general' ? entry.latencies : []);
  const languageLatencies =
    entry.languageLatencies ??
    (entry.suite === 'language' ? entry.latencies : []);
  output.medianGeneralSeconds =
    Number(median(generalLatencies)?.toFixed(3) ?? NaN) || null;
  output.medianLanguageSeconds =
    Number(median(languageLatencies)?.toFixed(3) ?? NaN) || null;
  output.medianDecodeTokS =
    Number(median(entry.decodeRates)?.toFixed(1) ?? NaN) || null;
  delete output.generalLatencies;
  delete output.languageLatencies;
  delete output.latencies;
  delete output.decodeRates;
  return output;
}

const qwenFlagged = opus.results.filter((result) => result.qwenFlag);
const qwenApproved = opus.results.filter((result) => !result.qwenFlag);
const summary = {
  cards: opus.results.length,
  reviewCards: reviewIds.size,
  opusVerdicts: Object.fromEntries(
    Object.entries(
      Object.groupBy(opus.results, (result) => result.opusVerdict),
    ).map(([key, values]) => [key, values.length]),
  ),
  finalDispositions: Object.fromEntries(
    Object.entries(
      Object.groupBy(
        opus.results,
        (result) => fableById.get(result.id)?.disposition ?? 'accepted',
      ),
    ).map(([key, values]) => [key, values.length]),
  ),
  qwen: {
    flagged: qwenFlagged.length,
    approved: qwenApproved.length,
    flaggedDispositions: Object.fromEntries(
      Object.entries(
        Object.groupBy(
          qwenFlagged,
          (result) => fableById.get(result.id)?.disposition ?? 'accepted',
        ),
      ).map(([key, values]) => [key, values.length]),
    ),
    missedDispositions: Object.fromEntries(
      Object.entries(
        Object.groupBy(
          qwenApproved.filter((result) => fableById.has(result.id)),
          (result) => fableById.get(result.id).disposition,
        ),
      ).map(([key, values]) => [key, values.length]),
    ),
  },
  models: [...modelData.values()]
    .map(finalize)
    .sort((a, b) => a.model.localeCompare(b.model)),
  campaigns: [...campaignData.values()]
    .map(finalize)
    .sort((a, b) => a.campaign.localeCompare(b.campaign)),
};

fs.writeFileSync(
  `${ROOT}/adjudication/summary.json`,
  `${JSON.stringify(summary, null, 2)}\n`,
);
console.log(
  `Wrote summary for ${summary.models.length} models and ${summary.cards} cards.`,
);
