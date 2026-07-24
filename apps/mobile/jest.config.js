const preset = require('jest-expo/jest-preset')

// pnpm resolves two React copies into the tree (the pinned 19.2.3 and a 19.2.7
// pulled via peers from web/api). react-test-renderer is built against 19.2.3,
// and the mismatch breaks hooks in tests ("Cannot read properties of null
// (reading 'useRef')"). Pin every react import in the test env to this package's
// single copy. Do not remove: a lockfile change silently reintroduces the split.
module.exports = {
  ...preset,
  moduleNameMapper: {
    ...(preset.moduleNameMapper || {}),
    '^react$': '<rootDir>/node_modules/react',
    '^react/(.*)$': '<rootDir>/node_modules/react/$1',
  },
}
