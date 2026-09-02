const preset = require('jest-expo/jest-preset');

// pnpm resolves two React copies into the tree (the pinned 19.2.3 and a 19.2.7
// pulled via peers from web/api). react-test-renderer is built against 19.2.3,
// and the mismatch breaks hooks in tests ("Cannot read properties of null
// (reading 'useRef')"). Pin every react import in the test env to this package's
// single copy. Do not remove: a lockfile change silently reintroduces the split.
// @remelondb packages and uuid ship ESM-only builds, and @rn-primitives (the
// behaviour layer under the react-native-reusables components) ships untranspiled
// JSX. Two things keep jest from parsing them: the preset ignores their inner
// node_modules path segments, and its transform only matches .js/.ts. Whitelist
// them and send .mjs through the same babel transformer.
const transformIgnorePatterns = preset.transformIgnorePatterns.map((pattern) =>
  pattern.replace('(?!(.pnpm|', '(?!(.pnpm|@remelondb|@rn-primitives|uuid|'),
);

module.exports = {
  ...preset,
  transformIgnorePatterns,
  transform: {
    ...preset.transform,
    '\\.mjs$': preset.transform['\\.[jt]sx?$'],
  },
  // The first render in a file pays the full babel transform of the RN
  // component graph; on CI runners that alone brushes the 5s default.
  testTimeout: 15000,
  moduleNameMapper: {
    ...(preset.moduleNameMapper || {}),
    '^react$': '<rootDir>/node_modules/react',
    '^react/(.*)$': '<rootDir>/node_modules/react/$1',
    // The theme preference reads it synchronously at render time.
    '^expo-sqlite/kv-store$': '<rootDir>/__mocks__/kv-store.ts',
    '^@/(.*)$': '<rootDir>/$1',
  },
};
