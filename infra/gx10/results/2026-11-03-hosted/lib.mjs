// Card extraction mirroring the gateway's parseCardsFromJson
// (apps/api/src/ai/ai-gateway.service.ts): stripThinking + bracket-depth
// slicing, so "parseOk" means "the app would serve this response".
export const THINK_TAG = /<\s*\/?\s*think(?:ing)?\s*>/i;

export function stripThinking(raw) {
  let cleaned = raw.trim();
  for (;;) {
    const opening = /<\s*think(?:ing)?\s*>/i.exec(cleaned);
    const jsonStartIndex = cleaned.indexOf('[');
    if (!opening || (jsonStartIndex !== -1 && jsonStartIndex < opening.index))
      return cleaned;
    const afterOpening = opening.index + opening[0].length;
    const closing = /<\s*\/\s*think(?:ing)?\s*>/i.exec(
      cleaned.slice(afterOpening),
    );
    if (!closing) return cleaned.slice(0, opening.index).trim();
    const afterClosing = afterOpening + closing.index + closing[0].length;
    cleaned =
      `${cleaned.slice(0, opening.index)}${cleaned.slice(afterClosing)}`.trim();
  }
}

export function extractJsonText(raw) {
  const text = stripThinking(raw);
  const start = text.indexOf('[');
  if (start === -1)
    throw new Error('AI response did not contain a valid JSON array');
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '[') depth++;
    else if (ch === ']' && --depth === 0) return text.slice(start, i + 1);
  }
  throw new Error('AI response did not contain a valid JSON array');
}

export function parseCards(raw) {
  const parsed = JSON.parse(extractJsonText(raw));
  if (!Array.isArray(parsed))
    throw new Error('Parsed AI output is not an array');
  return parsed;
}
