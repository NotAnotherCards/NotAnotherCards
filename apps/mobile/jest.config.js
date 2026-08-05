const preset = require('jest-expo/jest-preset')

// pnpm resolves two React copies into the tree (the pinned 19.2.3 and a 19.2.7
// pulled via peers from web/api). react-test-renderer is built against 19.2.3,
// and the mismatch breaks hooks in tests ("Cannot read properties of null
// (reading 'useRef')"). Pin every react import in the test env to this package's
// single copy. Do not remove: a lockfile change silently reintroduces the split.
// @remelondb packages ship ESM-only .mjs. Two things keep jest from parsing
// them: the preset ignores the inner node_modules/@remelondb path segment,
// and its transform only matches .js/.ts. Whitelist the scope and send .mjs
// through the same babel transformer.
const transformIgnorePatterns = preset.transformIgnorePatterns.map((pattern) =>
  pattern.replace('(?!(.pnpm|', '(?!(.pnpm|@remelondb|'),
)

module.exports = {
  ...preset,
  transformIgnorePatterns,
  transform: {
    ...preset.transform,
    '\\.mjs$': preset.transform['\\.[jt]sx?$'],
  },
  moduleNameMapper: {
    ...(preset.moduleNameMapper || {}),
    '^react$': '<rootDir>/node_modules/react',
    '^react/(.*)$': '<rootDir>/node_modules/react/$1',
    // The theme preference reads it synchronously at render time.
    '^expo-sqlite/kv-store$': '<rootDir>/__mocks__/kv-store.ts',
  },
}
