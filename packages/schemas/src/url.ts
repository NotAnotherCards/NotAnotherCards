const SAFE_PROTOCOLS = new Set(['https:', 'http:', 'mailto:', 'blob:']);

const SAFE_DATA_URL_PATTERN =
  /^data:(?:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml)|audio\/(?:mp3|wav|ogg|mpeg|aac|m4a));/i;

const URL_SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):/i;
const URL_PARSER_IGNORED_WHITESPACE_PATTERN = /[\t\n\r]/g;

function normalizeForSchemeDetection(value: string): string {
  let start = 0;
  let end = value.length;

  while (start < end && value.charCodeAt(start) <= 0x20) {
    start += 1;
  }

  while (end > start && value.charCodeAt(end - 1) <= 0x20) {
    end -= 1;
  }

  return value
    .slice(start, end)
    .replace(URL_PARSER_IGNORED_WHITESPACE_PATTERN, '');
}

/**
 * Reports whether a URL is safe to expose from user-authored card content.
 *
 * Scheme detection is deliberately independent of the platform URL class.
 * React Native's implementation resolves non-HTTP schemes against a supplied
 * base, which can make an unsafe absolute URL appear to use HTTPS.
 */
export function isSafeUrl(value: string): boolean {
  // WHATWG URL parsing ignores tabs and line breaks before identifying the
  // scheme. Apply that normalization here so java\tscript: cannot masquerade
  // as a relative URL.
  const normalizedValue = normalizeForSchemeDetection(value);
  const schemeMatch = URL_SCHEME_PATTERN.exec(normalizedValue);

  if (!schemeMatch) {
    return true;
  }

  const protocol = `${schemeMatch[1].toLowerCase()}:`;
  if (SAFE_PROTOCOLS.has(protocol)) {
    return true;
  }

  return protocol === 'data:' && SAFE_DATA_URL_PATTERN.test(normalizedValue);
}
