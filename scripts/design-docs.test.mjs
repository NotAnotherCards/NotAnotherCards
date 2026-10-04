import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  compareInventory,
  compareNavigation,
  comparePalettes,
  compareRawPalette,
  hexColor,
  palettes,
  rawPaletteCount,
} from './design-docs.mjs';

test('hex and oklch convert to the same RGB triplet format', () => {
  assert.equal(hexColor('24 24 27'), '#18181b');
  assert.equal(hexColor('oklch(1 0 0)'), '#ffffff');
});

test('palette drift names mode and token', () => {
  const web = palettes(
    ':root { --primary: #5865b5; } .dark { --primary: #9da8ec; }',
    '.dark',
  );
  const mobile = palettes(
    ':root { --primary: 88 101 181; } @media (prefers-color-scheme: dark) { :root { --primary: 1 2 3; } }',
    'media',
  );
  assert.deepEqual(comparePalettes(web, mobile), [
    'dark --primary: web #9da8ec, mobile #010203',
  ]);
});

test('a token missing in dark mode is not silently accepted', () => {
  const web = palettes(
    ':root { --primary: #5865b5; } .dark { --primary: #9da8ec; }',
    '.dark',
  );
  const mobile = palettes(
    ':root { --primary: 88 101 181; } @media (prefers-color-scheme: dark) { :root { --background: 24 24 27; } }',
    'media',
  );
  assert.ok(
    comparePalettes(web, mobile).includes(
      'dark --primary: missing mobile token',
    ),
  );
});

test('navigation colors follow mobile tokens', () => {
  const declarations =
    '--background: 255 255 255;\n --surface: 242 246 242;\n --foreground: 24 24 27;\n --card: 255 255 255;\n --border: 228 228 231;';
  const mobile = palettes(
    `:root { ${declarations} } @media (prefers-color-scheme: dark) { :root { ${declarations} } }`,
    'media',
  );
  const theme =
    "export const navigationColors = { light: { background: '#000000', surface: '#f2f6f2', foreground: '#18181b', card: '#ffffff', border: '#e4e4e7' }, dark: { background: '#ffffff', surface: '#f2f6f2', foreground: '#18181b', card: '#ffffff', border: '#e4e4e7' } } as const;";
  assert.deepEqual(compareNavigation(theme, mobile), [
    'navigationColors light.background: expected #ffffff, got #000000',
  ]);
});

test('inventory drift names the missing and stale files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'design-docs-'));
  try {
    const web = join(root, 'web');
    const mobile = join(root, 'mobile');
    const { mkdir } = await import('node:fs/promises');
    await mkdir(web);
    await mkdir(mobile);
    await writeFile(join(web, 'button.tsx'), '');
    await writeFile(join(mobile, 'card.tsx'), '');
    const doc =
      '### Inventory\n| web | mobile |\n| --- | --- |\n| `missing` | `card` |\n';
    assert.deepEqual(compareInventory(doc, [web, mobile]), [
      'web inventory: add button',
      'web inventory: remove missing',
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a navigation color without its mobile token is reported', () => {
  const mobile = palettes(
    ':root { --background: 255 255 255; } @media (prefers-color-scheme: dark) { :root { --background: 24 24 27; } }',
    'media',
  );
  const theme =
    "export const navigationColors = { light: { background: '#ffffff' }, dark: { background: '#18181b' } } as const;";
  assert.ok(
    compareNavigation(theme, mobile).includes(
      'navigationColors light.card: missing mobile token --card',
    ),
  );
});

test('raw palette utilities are counted, tokens are not', () => {
  assert.equal(
    rawPaletteCount(
      "'bg-amber-500/10 text-emerald-600 dark:text-emerald-400 bg-warning text-rating-easy border-sage-border'",
    ),
    3,
  );
});

test('the raw palette baseline only moves down', () => {
  assert.deepEqual(
    compareRawPalette(
      { 'a.tsx': 3, 'b.tsx': 1, 'new.tsx': 1 },
      {
        'a.tsx': 2,
        'b.tsx': 4,
        'gone.tsx': 2,
      },
    ),
    [
      'raw palette: a.tsx has 3 raw colour utilities, baseline allows 2; use a semantic token',
      'raw palette: b.tsx is down to 1; lower its baseline from 4',
      'raw palette: gone.tsx has none left; remove it from the baseline',
      'raw palette: new.tsx has 1 raw colour utilities, baseline allows 0; use a semantic token',
    ],
  );
});
