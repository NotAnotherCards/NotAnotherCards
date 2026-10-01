import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./build-release.sh', import.meta.url));

// No signing environment: valid URLs must stop at the keystore guard,
// before prebuild or Gradle. Exercise the real script, not a copied parser.
for (const [url, valid] of [
  [undefined, false],
  ['', false],
  ['https://', false],
  ['http://cards.dustyway.org', false],
  ['https://cards.dustyway.org:65536', false],
  ['https://cards.dustyway.org:abc', false],
  ['https://bad host', false],
  ['https://cards.dustyway.org', true],
  ['https://cards.dustyway.org:65535/api', true],
  ['https://[::1]:443/api', true],
]) {
  const result = spawnSync('bash', [script], {
    env: {
      PATH: process.env.PATH,
      ...(url === undefined ? {} : { EXPO_PUBLIC_API_URL: url }),
    },
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1, `Unexpected exit for ${url}`);
  assert.match(
    result.stderr,
    valid ? /NAC_KEYSTORE is not set/ : /EXPO_PUBLIC_API_URL must be/,
    `Wrong validation outcome for ${url}`,
  );
}
console.log('Release URL validation: 10 cases passed');
