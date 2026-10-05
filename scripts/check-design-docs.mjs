import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import {
  compareInventory,
  compareNavigation,
  comparePalettes,
  compareRawPalette,
  palettes,
  rawPaletteUses,
} from './design-docs.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8');
try {
  const web = palettes(read('apps/web/src/style.css'), '.dark');
  const mobile = palettes(read('apps/mobile/global.css'), 'media');
  const problems = [
    ...compareInventory(read('docs/design.md'), [
      join(root, 'apps/web/src/components/ui'),
      join(root, 'apps/mobile/components/ui'),
    ]),
    ...comparePalettes(web, mobile),
    ...compareNavigation(read('apps/mobile/lib/theme.ts'), mobile),
    ...compareRawPalette(
      rawPaletteUses(root, ['apps/web/src', 'apps/mobile']),
      JSON.parse(read('scripts/design-raw-palette.json')),
    ),
  ];
  if (problems.length) throw new Error(problems.join('\n'));
  console.log(
    'Design inventory, shared light/dark colors and the raw palette baseline match web and mobile.',
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
