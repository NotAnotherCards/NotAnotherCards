// Hard-task probes for model benchmarking: long German source texts with
// invented details (tests reading, not priors), exact-recall topics, and a
// worked base-rate example. Complements model-test.mts (the standard six).
//
//   node hard-probe.mjs <model> [task] [--runs=N] [--nothink] [--oai]
//
// Talks to ollama's /api/chat by default (PROBE_BASE, default a local
// tunnel to the box: ssh -L 11435:127.0.0.1:11434 gx10). --oai switches
// to an OpenAI-style /v1/chat/completions endpoint instead.
const BASE = process.env.PROBE_BASE || 'http://127.0.0.1:11435';

const GERMAN_TEXT = `Die Semmeringbahn verbindet Gloggnitz in Niederösterreich mit Mürzzuschlag in der Steiermark und gilt als die erste Gebirgsbahn Europas, die über einen Alpenpass führt. Gebaut wurde sie zwischen 1848 und 1854 nach den Plänen des Ingenieurs Carl von Ghega. Am 17. Juli 1854 wurde die rund 41 Kilometer lange Strecke feierlich eröffnet. Seit 1998 gehört sie zum UNESCO-Welterbe.

Der Betrieb in den Anfangsjahren war beschwerlich. Der Lokführer Johann Prettner, der ab 1855 auf der Strecke fuhr, notierte in seinem Dienstbuch, dass er an Wintertagen bereits um halb fünf Uhr früh die Bremsen aller Wagen einzeln prüfen musste, bevor der erste Zug um sechs Uhr zehn den Bahnhof Gloggnitz verließ. Bei Schneeverwehungen am Wolfsbergkogel mussten bis zu vierzig Arbeiter mit Schaufeln ausrücken; sie erhielten dafür einen Tageslohn von einem Gulden und zwanzig Kreuzern sowie eine warme Mahlzeit im Bahnwärterhaus Nummer 167.

Die größte technische Herausforderung war der Haupttunnel unter dem Semmeringpass. Während der Bauarbeiten beschäftigte die Baustelle zeitweise bis zu 20.000 Menschen, darunter viele Arbeiterinnen, die Schotter für das Gleisbett klopften. Der Bauleiter des Tunnelabschnitts, ein Böhme namens Wenzel Kraus, führte ein striktes Regime: Wer dreimal zu spät zur Schicht erschien, verlor den Anspruch auf die Werksuppe. Dennoch galt die Baustelle als begehrter Arbeitsplatz, weil der Lohn pünktlich jeden Samstag um fünf Uhr nachmittags ausgezahlt wurde.

Für die steilen Abschnitte mit Neigungen von bis zu 25 Promille entwickelte man eigens neue Lokomotiven. Aus einem Wettbewerb im Jahr 1851, bei dem vier Maschinen gegeneinander antraten, ging die Bauart des Konstrukteurs Wilhelm von Engerth als Grundlage der späteren Betriebslokomotiven hervor. Eine dieser Maschinen, die "Kapellen", zog bei einer Probefahrt im November 1853 einen Zug von 140 Tonnen mit zwölf Stundenkilometern über die Passhöhe, wobei der Heizer Matthias Zöhrer nach eigener Aussage vier Zentner Kohle verfeuerte.

Heute befahren täglich rund 170 Züge die Strecke. Die Fahrt von Gloggnitz nach Mürzzuschlag dauert mit dem Regionalzug etwa fünfzig Minuten, und der höchste Punkt der Strecke liegt am Bahnhof Semmering auf 895 Metern Seehöhe.`;

const FORMAT = 'Antworte ausschließlich mit einem JSON-Array von Objekten mit den Feldern "front" und "back". Kein weiterer Text.';

const GERMAN2 = `Die Wuppertaler Schwebebahn wurde am 1. März 1901 für den öffentlichen Verkehr eröffnet und ist bis heute das Wahrzeichen der Stadt. Die Konstruktion nach dem System des Ingenieurs Eugen Langen hängt an einem stählernen Gerüst und folgt auf rund 13 Kilometern überwiegend dem Lauf der Wupper. Schon im Oktober 1900 fuhr Kaiser Wilhelm II. mit dem eigens hergerichteten Kaiserwagen zur Probe.

Der Fahrbetrieb der ersten Jahre war streng getaktet. Der Schaffner Hermann Kesselheim, der ab 1903 auf der Linie arbeitete, vermerkte in seinem Rapportheft, dass der erste Wagen werktags um fünf Uhr fünfundzwanzig die Station Vohwinkel verließ und die Fahrkarte dritter Klasse zehn Pfennig kostete. Wer den Wagen an der Endstation verpasste, wartete höchstens zwölf Minuten auf den nächsten.

In der Hauptwerkstatt an der Kluse arbeiteten um 1910 achtundvierzig Schlosser in zwei Schichten. Werkmeister August Brendel duldete keine offenen Ölkannen auf den Arbeitsbänken; wer dagegen verstieß, zahlte fünf Pfennig in die Kaffeekasse der Werkstatt. Das gesammelte Geld wurde jedes Jahr am Nikolaustag für einen gemeinsamen Abend im Gasthaus Zur Kohlfurth ausgegeben.

Berühmt wurde die Bahn auch durch das Elefantenkind Tuffi, das im Juli 1950 bei einer Werbefahrt aus dem Wagen in die Wupper sprang und den Sturz fast unverletzt überstand. Heute befördert die Schwebebahn an Werktagen rund 80.000 Fahrgäste, und eine vollständige Fahrt von Oberbarmen nach Vohwinkel dauert etwa dreißig Minuten.`;

const TASKS = {
  'long-german': {
    prompt: `Erstelle genau 6 Lernkarten ausschließlich auf Basis des folgenden Textes. Die Karten müssen konkrete Details aus dem Text abfragen (Personen, Zahlen, Uhrzeiten), nicht allgemeines Wissen. ${FORMAT}\n\nTEXT:\n${GERMAN_TEXT}`,
  },
  'emperors': {
    prompt: 'Create exactly 6 flashcards about the Julio-Claudian emperors of Rome (Augustus through Nero), each asking for exact reign dates or the succession order. Answer only with a JSON array of objects with fields "front" and "back". No other text.',
  },
  'bayes': {
    prompt: 'Create exactly 4 flashcards teaching the base rate fallacy with this worked example: a disease has 1% prevalence, the test has 90% sensitivity and 91% specificity. One card must derive P(disease | positive test) step by step with the correct final percentage. Answer only with a JSON array of objects with fields "front" and "back". No other text.',
  },
  'metals': {
    prompt: 'Create exactly 5 flashcards about common oxidation states and aqueous solution colors of first-row transition metal ions (iron, copper, manganese, chromium, nickel). Each card must name an exact oxidation state or color. Answer only with a JSON array of objects with fields "front" and "back". No other text.',
  },
  'treaties': {
    prompt: 'Create exactly 5 flashcards about treaties of the Napoleonic era (Campo Formio, Luneville, Amiens, Tilsit, first Treaty of Paris 1814), each asking for the exact date or year and the parties. Answer only with a JSON array of objects with fields "front" and "back". No other text.',
  },
  'german2': {
    prompt: `Erstelle genau 6 Lernkarten ausschliesslich auf Basis des folgenden Textes. Die Karten muessen konkrete Details aus dem Text abfragen (Personen, Zahlen, Uhrzeiten), nicht allgemeines Wissen. ${FORMAT}\n\nTEXT:\n${GERMAN2}`,
  },
};

const model = process.argv[2];
const only = process.argv.slice(3).find((a) => !a.startsWith('--'));
if (!model) { console.error('usage: node hard-probe.mjs <model> [task]'); process.exit(1); }

const runsArg = process.argv.find((a) => a.startsWith('--runs='));
const runs = runsArg ? Number(runsArg.split('=')[1]) : 1;

for (const [name, task] of Object.entries(TASKS)) {
  if (only && name !== only) continue;
  for (let run = 1; run <= runs; run++) {
  const t0 = Date.now();
  const oai = process.argv.includes('--oai');
  const res = await fetch(oai ? `${BASE}/v1/chat/completions` : `${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer none' },
    body: JSON.stringify(oai ? {
      model,
      messages: [{ role: 'user', content: task.prompt }],
      max_tokens: 8000,
    } : {
      model,
      messages: [{ role: 'user', content: task.prompt }],
      stream: false,
      think: process.argv.includes('--nothink') ? false : undefined,
      options: { num_predict: 8000 },
    }),
  });
  const d = await res.json();
  const msg = oai ? (d.choices?.[0]?.message ?? {}) : (d.message ?? {});
  const content = (msg.content ?? '').trim();
  const wallS = (Date.now() - t0) / 1000;
  const evalTok = oai
    ? (d.usage?.completion_tokens ? (d.usage.completion_tokens / wallS).toFixed(1) + '~' : '?')
    : (d.eval_count && d.eval_duration ? (d.eval_count / (d.eval_duration / 1e9)).toFixed(1) : '?');
  const promptTok = oai
    ? `${d.usage?.prompt_tokens ?? '?'} tok prompt`
    : (d.prompt_eval_count && d.prompt_eval_duration ? (d.prompt_eval_count / (d.prompt_eval_duration / 1e9)).toFixed(1) : '?');
  let parse = 'parse FAILED';
  try {
    const stripped = content.replace(/^```(json)?/m, '').replace(/```$/m, '').trim();
    const cards = JSON.parse(stripped);
    const ok = Array.isArray(cards) && cards.every((c) => typeof c.front === 'string' && typeof c.back === 'string');
    parse = ok ? `${cards.length} cards, fields ok` : 'parse: wrong shape';
  } catch (e) { parse = `parse FAILED: ${e.message.slice(0, 60)}`; }
  console.log(`== ${model} / ${name}#${run}: prompt ${d.prompt_eval_count ?? '?'} tok @ ${promptTok} tok/s | gen ${d.eval_count ?? '?'} tok @ ${evalTok} tok/s | total ${((Date.now() - t0) / 1000).toFixed(1)}s | ${parse}`);
  if (msg.reasoning) console.log(`-- reasoning: ${msg.reasoning.length} chars`);
  console.log(content, '\n');
  }
}
