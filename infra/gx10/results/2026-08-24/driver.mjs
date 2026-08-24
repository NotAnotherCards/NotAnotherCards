// Overnight GX10 benchmark campaign. Sequential generation, native /api/chat
// for full timing data (eval_duration, thinking field). Writes one JSONL per
// campaign plus campaign.log. Pulls happen outside this script.
const BASE = 'http://127.0.0.1:11434';
const fs = await import('node:fs');
const OUT = '/tmp/campaign';
const FORMAT =
  'Reply with only a JSON array, each element {"front": string, "back": string}. ' +
  'Front is a question or prompt, back is the answer. Keep each side under 20 words.';
const GERMAN_TEXT =
  'Der Bäcker öffnet seine Backstube jeden Morgen um vier Uhr. Er ' +
  'knetet den Teig, während die Stadt noch schläft. Um sieben Uhr duftet ' +
  'die ganze Straße nach frischem Brot.';
const PROMPTS = {
  spanish:
    'You generate flashcards for a spaced-repetition app. Create 5 flashcards for the topic "Spanish preterite tense for beginners". ' +
    FORMAT,
  biology:
    'You generate flashcards for a spaced-repetition app. Create 5 flashcards for the topic "photosynthesis, for a high school biology student". ' +
    FORMAT,
  german:
    'You generate flashcards for a spaced-repetition app. From the German text below, create 4 comprehension flashcards in German for an A2 learner. Text: "' +
    GERMAN_TEXT +
    '" ' +
    FORMAT,
  history:
    'You generate flashcards for a spaced-repetition app. Create 5 flashcards for the topic "key events of the French Revolution with dates". ' +
    FORMAT,
  programming:
    'You generate flashcards for a spaced-repetition app. Create 5 flashcards for the topic "JavaScript array methods (map, filter, reduce)". ' +
    FORMAT,
  music:
    'You generate flashcards for a spaced-repetition app. Create 5 flashcards for the topic "music intervals for beginners (thirds, fifths, octaves)". ' +
    FORMAT,
};
// campaign order: baseline, rerun target, candidates (waiting for pulls), drift check
const CAMPAIGNS = [
  { id: 'qwen3.6-start', model: 'qwen3.6:35b' },
  { id: 'qwen3.8', model: 'qwen3.8:27b' },
  { id: 'gemma4-26b-a4b', model: 'gemma4:26b-a4b-it-q4_K_M' },
  {
    id: 'nemotron-3.5-lightning',
    model: 'nemotron-3.5-lightning:30b-a3b-q4_K_M',
  },
  { id: 'ornith-1.5', model: 'ornith-1.5:35b' },
  { id: 'laguna-xs-2.1', model: 'laguna-xs-2.1:q4_K_M' },
  { id: 'muse-glimmer', model: 'muse-glimmer:30b-q4_K_M' },
  { id: 'qwen3.6-end', model: 'qwen3.6:35b' },
];
const log = (m) => {
  const line = `[${new Date().toISOString()}] ${m}`;
  console.log(line);
  fs.appendFileSync(`${OUT}/campaign.log`, line + '\n');
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, body, timeoutMs = 300000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    if (!res.ok)
      throw new Error(`${res.status} ${(await res.text()).slice(0, 150)}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}
async function present(model) {
  try {
    const res = await fetch(`${BASE}/api/tags`);
    const tags = (await res.json()).models.map((m) => m.name);
    return tags.includes(model);
  } catch {
    return false;
  } // tunnel blip: treat as not-yet, keep waiting
}
for (const c of CAMPAIGNS) {
  const outFile = `${OUT}/${c.id}.jsonl`;
  if (
    fs.existsSync(outFile) &&
    fs.readFileSync(outFile, 'utf8').trim().split('\n').length >= 30
  ) {
    log(`${c.id}: already complete, skipping`);
    continue;
  }
  while (!(await present(c.model))) {
    log(`${c.id}: waiting for pull of ${c.model}`);
    await sleep(120000);
  }
  let show;
  for (let attempt = 1; ; attempt++) {
    try {
      show = await api('/api/show', { model: c.model });
      break;
    } catch (e) {
      if (attempt >= 10) throw e;
      log(`${c.id}: show failed (${e.message}), retry ${attempt}`);
      await sleep(30000);
    }
  }
  const caps = show.capabilities ?? [];
  const meta = {
    family: show.details?.family,
    quant: show.details?.quantization_level,
    params: show.details?.parameter_size,
    capabilities: caps,
  };
  const thinking = caps.includes('thinking');
  log(`${c.id}: ${c.model} ${JSON.stringify(meta)}`);
  // warm-up (excluded from measurements); also the think-disable probe
  const probeBody = {
    model: c.model,
    messages: [{ role: 'user', content: 'Reply with the word ok.' }],
    stream: false,
    ...(thinking && { think: false }),
  };
  let probe;
  try {
    probe = await api('/api/chat', probeBody);
  } catch (e) {
    log(`${c.id}: warmup FAILED ${e.message}`);
    continue;
  }
  const probeThink = (probe.message.thinking ?? '').length;
  log(
    `${c.id}: warm, thinking=${thinking}, probe reasoning chars=${probeThink}`,
  );
  let consecFail = 0;
  for (const [topic, prompt] of Object.entries(PROMPTS)) {
    for (let run = 1; run <= 5; run++) {
      const rec = {
        campaign: c.id,
        model: c.model,
        ...meta,
        thinkParam: thinking ? false : null,
        topic,
        run,
        ts: new Date().toISOString(),
      };
      const t0 = Date.now();
      try {
        const j = await api('/api/chat', {
          model: c.model,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          ...(thinking && { think: false }),
        });
        rec.seconds = (Date.now() - t0) / 1000;
        rec.raw = j.message.content;
        rec.reasoningChars = (j.message.thinking ?? '').length;
        rec.promptTokens = j.prompt_eval_count;
        rec.answerTokens = j.eval_count;
        rec.decodeTokS = j.eval_duration
          ? j.eval_count / (j.eval_duration / 1e9)
          : null;
        rec.loadSeconds = j.load_duration ? j.load_duration / 1e9 : 0;
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
        } catch (e) {
          rec.parseOk = false;
          rec.parseError = String(e).slice(0, 100);
        }
        consecFail = 0;
      } catch (e) {
        rec.error = String(e).slice(0, 200);
        rec.seconds = (Date.now() - t0) / 1000;
        if (++consecFail >= 5) {
          log(`${c.id}: 5 consecutive failures, aborting campaign`);
          fs.appendFileSync(outFile, JSON.stringify(rec) + '\n');
          break;
        }
      }
      fs.appendFileSync(outFile, JSON.stringify(rec) + '\n');
    }
    if (consecFail >= 5) break;
    log(`${c.id}: ${topic} done`);
  }
  log(`${c.id}: campaign complete`);
}
log('ALL CAMPAIGNS DONE');
