const RELATIVE_URL_BASE = 'https://relative.invalid';

const SAFE_PROTOCOLS = new Set(['https:', 'http:', 'mailto:', 'blob:']);

const SAFE_DATA_URL_PATTERN =
  /^data:(?:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml)|audio\/(?:mp3|wav|ogg|mpeg|aac|m4a));/i;

/**
 * Reports whether a URL is safe to expose from user-authored card content.
 *
 * The fixed HTTPS base lets the platform URL parser handle every relative URL
 * shape without coupling this shared policy to either a browser location or a
 * native navigation context.
 */
export function isSafeUrl(value: string): boolean {
  try {
    const url = new URL(value, RELATIVE_URL_BASE);

    if (SAFE_PROTOCOLS.has(url.protocol)) {
      return true;
    }

    return url.protocol === 'data:' && SAFE_DATA_URL_PATTERN.test(value);
  } catch {
    return false;
  }
}
