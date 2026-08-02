// Card-generation smoke test for models behind the gateway.
//
//   node model-test.mts <model> [--nothink] [--topic <name>] [--base <url>] [--key <key>]
//
// --topic runs a single topic (e.g. --topic programming for the
// JavaScript cards) instead of all six.
//
// Runs directly with node >= 23.6 (native type stripping), no build step.
// Talks to the public gateway by default; --base http://127.0.0.1:11434/v1
// on the box talks to ollama directly. Prints per-prompt speed, whether the
// reply parsed as valid cards, and the cards themselves. Results feed
// docs/model-report.md — rerun this before adding a model to the config.

interface Card {
  front: string;
  back: string;
}

const args = process.argv.slice(2);
const model = args[0];
if (!model || model.startsWith("--")) {
  console.error("usage: node model-test.mts <model> [--nothink] [--base <url>] [--key <key>]");
  process.exit(1);
}
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const base = flag("--base") ?? "https://ai.dustyway.org/v1";
const key = flag("--key") ?? process.env.AI_API_KEY ?? "";
const nothink = args.includes("--nothink");

const FORMAT =
  'Reply with only a JSON array, each element {"front": string, "back": string}. ' +
  "Front is a question or prompt, back is the answer. Keep each side under 20 words.";

const PROMPTS: Record<string, string> = {
  spanish:
    "You generate flashcards for a spaced-repetition app. Create 5 flashcards " +
    'for the topic "Spanish preterite tense for beginners". ' + FORMAT,
  biology:
    "You generate flashcards for a spaced-repetition app. Create 5 flashcards " +
    'for the topic "photosynthesis, for a high school biology student". ' + FORMAT,
  german:
    "You generate flashcards for a spaced-repetition app. From the German text " +
    "below, create 4 comprehension flashcards in German for an A2 learner. " +
    'Text: "Der Bäcker öffnet seine Backstube jeden Morgen um vier Uhr. Er ' +
    "knetet den Teig, während die Stadt noch schläft. Um sieben Uhr duftet " +
    'die ganze Straße nach frischem Brot." ' + FORMAT,
  history:
    "You generate flashcards for a spaced-repetition app. Create 5 flashcards " +
    'for the topic "key events of the French Revolution with dates". ' + FORMAT,
  programming:
    "You generate flashcards for a spaced-repetition app. Create 5 flashcards " +
    'for the topic "JavaScript array methods (map, filter, reduce)". ' + FORMAT,
  music:
    "You generate flashcards for a spaced-repetition app. Create 5 flashcards " +
    'for the topic "music intervals for beginners (thirds, fifths, octaves)". ' + FORMAT,
};

async function ask(prompt: string): Promise<{ content: string; tokens: number; seconds: number }> {
  const body = {
    model,
    messages: [{ role: "user", content: prompt }],
    ...(nothink && { think: false }),
  };
  const started = performance.now();
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key && { Authorization: `Bearer ${key}` }),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const json = await res.json();
  return {
    content: json.choices[0].message.content as string,
    tokens: (json.usage?.completion_tokens as number | undefined) ?? 0,
    seconds: (performance.now() - started) / 1000,
  };
}

const topic = flag("--topic");
if (topic && !(topic in PROMPTS)) {
  console.error(`unknown topic "${topic}"; available: ${Object.keys(PROMPTS).join(", ")}`);
  process.exit(1);
}
const selected = topic ? { [topic]: PROMPTS[topic] } : PROMPTS;

await ask(Object.values(selected)[0]); // warm-up / model load, discarded

for (const [name, prompt] of Object.entries(selected)) {
  const { content, tokens, seconds } = await ask(prompt);
  let cards: Card[] | null = null;
  let verdict: string;
  try {
    cards = JSON.parse(content.slice(content.indexOf("["), content.lastIndexOf("]") + 1));
    const ok = cards!.every(
      (c) => typeof c.front === "string" && typeof c.back === "string" && Object.keys(c).length === 2,
    );
    verdict = `parse: ${cards!.length} cards, fields ${ok ? "ok" : "WRONG"}`;
  } catch (e) {
    verdict = `parse FAILED: ${(e as Error).message}`;
  }
  console.log(
    `${name}: ${tokens} tok, ${(tokens / seconds).toFixed(1)} tok/s, ${seconds.toFixed(1)}s | ${verdict}`,
  );
  console.log(JSON.stringify(cards ?? content.slice(0, 600), null, 1).slice(0, 1600), "\n");
}
