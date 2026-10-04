import { readdirSync, readFileSync } from 'node:fs';
import { extname, basename, join, relative } from 'node:path';

export function inventory(document) {
  const section = document.split('### Inventory')[1]?.split(/^### /m)[0];
  const rows =
    section?.split('\n').filter((line) => line.startsWith('|')) ?? [];
  const columns = [new Set(), new Set()];
  for (const row of rows.slice(2)) {
    const cells = row.split('|').slice(1, 3);
    cells.forEach((rawCell, index) => {
      const cell = rawCell.replace(/\s*\([^)]*\)/g, '');
      for (const [, name] of cell.matchAll(/`([^`]+)`/g))
        columns[index].add(name);
    });
  }
  return columns;
}

export function filesIn(directory) {
  return new Set(
    readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.[jt]sx?$/.test(entry.name))
      .map((entry) => basename(entry.name, extname(entry.name))),
  );
}

export function cssTokens(block) {
  return new Map(
    [...block.matchAll(/^\s*(--[a-z][a-z0-9-]*):\s*([^;]+);/gm)].map(
      ([, name, value]) => [name, value.trim()],
    ),
  );
}

export function palettes(css, darkSelector) {
  const roots = [...css.matchAll(/:root\s*\{([^{}]*)\}/g)];
  const light = roots[0]?.[1];
  const dark =
    darkSelector === '.dark'
      ? css.match(/\.dark\s*\{([^{}]*)\}/)?.[1]
      : roots.at(-1)?.[1];
  if (!light || !dark) throw new Error('Missing light or dark palette');
  return { light: cssTokens(light), dark: cssTokens(dark) };
}

export function hexColor(value) {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  const rgb = value.match(/^(\d{1,3}) (\d{1,3}) (\d{1,3})$/);
  if (rgb) {
    const channels = rgb.slice(1).map(Number);
    if (channels.some((channel) => channel > 255))
      throw new Error(`Invalid RGB: ${value}`);
    return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
  }
  const oklch = value.match(/^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/);
  if (!oklch) throw new Error(`Unsupported color: ${value}`);
  const light = Number(oklch[1]);
  const chroma = Number(oklch[2]);
  const hue = Number(oklch[3]);
  const angle = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(angle);
  const b = chroma * Math.sin(angle);
  const l = (light + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (light - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (light - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const channels = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return `#${channels
    .map((linear) => {
      const gamma =
        linear <= 0.0031308
          ? 12.92 * linear
          : 1.055 * linear ** (1 / 2.4) - 0.055;
      return Math.round(Math.max(0, Math.min(1, gamma)) * 255)
        .toString(16)
        .padStart(2, '0');
    })
    .join('')}`;
}

export function compareInventory(document, directories) {
  const listed = inventory(document);
  const problems = [];
  for (const [index, directory] of directories.entries()) {
    const client = index === 0 ? 'web' : 'mobile';
    const actual = filesIn(directory);
    for (const name of actual)
      if (!listed[index].has(name))
        problems.push(`${client} inventory: add ${name}`);
    for (const name of listed[index])
      if (!actual.has(name))
        problems.push(`${client} inventory: remove ${name}`);
  }
  return problems;
}

export function comparePalettes(web, mobile) {
  const problems = [];
  for (const mode of ['light', 'dark']) {
    const names = new Set([...mobile.light.keys(), ...mobile.dark.keys()]);
    for (const name of names) {
      const mobileValue = mobile[mode].get(name);
      if (!mobileValue) {
        problems.push(`${mode} ${name}: missing mobile token`);
        continue;
      }
      const webValue = web[mode].get(name);
      if (!webValue) {
        problems.push(`${mode} ${name}: mobile token has no web counterpart`);
      } else {
        try {
          const expected = hexColor(webValue);
          const actual = hexColor(mobileValue);
          if (expected !== actual)
            problems.push(`${mode} ${name}: web ${expected}, mobile ${actual}`);
        } catch (error) {
          problems.push(`${mode} ${name}: ${error.message}`);
        }
      }
    }
  }
  return problems;
}

export function compareNavigation(theme, mobile) {
  const problems = [];
  const section = theme
    .split('export const navigationColors =')[1]
    ?.split('} as const;')[0];
  if (!section) return ['navigationColors: missing from theme.ts'];
  const names = {
    background: '--background',
    surface: '--surface',
    foreground: '--foreground',
    card: '--card',
    border: '--border',
  };
  for (const mode of ['light', 'dark']) {
    const block = section.match(new RegExp(`${mode}:\\s*\\{([^{}]*)\\}`))?.[1];
    if (!block) {
      problems.push(`navigationColors: missing ${mode}`);
      continue;
    }
    for (const [key, token] of Object.entries(names)) {
      const actual = block.match(new RegExp(`${key}:\\s*'([^']+)'`))?.[1];
      const value = mobile[mode].get(token);
      if (!value) {
        problems.push(
          `navigationColors ${mode}.${key}: missing mobile token ${token}`,
        );
        continue;
      }
      const expected = hexColor(value);
      if (actual?.toLowerCase() !== expected)
        problems.push(
          `navigationColors ${mode}.${key}: expected ${expected}, got ${actual ?? 'missing'}`,
        );
    }
  }
  return problems;
}

const RAW_PALETTE =
  /(?<![\w-])[a-z]+(?:-[a-z]+)*-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-(?:50|[1-9]00|950)(?![\w-])/g;

export function rawPaletteCount(source) {
  return source.match(RAW_PALETTE)?.length ?? 0;
}

const SKIPPED = new Set(['node_modules', 'android', 'ios', 'dist', 'build']);

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory())
      return SKIPPED.has(entry.name) || entry.name.startsWith('.')
        ? []
        : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

// Raw palette utilities per file, outside components/ui, as { path: count }.
export function rawPaletteUses(root, directories) {
  const counts = {};
  for (const directory of directories)
    for (const file of sourceFiles(join(root, directory))) {
      const path = relative(root, file).split('\\').join('/');
      if (path.includes('/components/ui/')) continue;
      const count = rawPaletteCount(readFileSync(file, 'utf8'));
      if (count) counts[path] = count;
    }
  return counts;
}

// A ratchet: a count may only fall, and the baseline follows it down.
export function compareRawPalette(counts, baseline) {
  const problems = [];
  const paths = new Set([...Object.keys(counts), ...Object.keys(baseline)]);
  for (const path of [...paths].sort()) {
    const actual = counts[path] ?? 0;
    const allowed = baseline[path] ?? 0;
    if (actual > allowed)
      problems.push(
        `raw palette: ${path} has ${actual} raw colour utilities, baseline allows ${allowed}; use a semantic token`,
      );
    else if (actual < allowed)
      problems.push(
        actual
          ? `raw palette: ${path} is down to ${actual}; lower its baseline from ${allowed}`
          : `raw palette: ${path} has none left; remove it from the baseline`,
      );
  }
  return problems;
}
