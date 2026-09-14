module.exports = {
  env: {
    node: true,
  },
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  plugins: ['@typescript-eslint', 'regexp'],
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2020,
  },
  rules: {
    '@typescript-eslint/no-non-null-assertion': 'off',
    // The core rule does not account for regex semantics; use the
    // regexp-aware replacement below for regular expression literals.
    'no-useless-escape': 'off',
    // Keep character-class edits from silently widening security regexes.
    'regexp/no-obscure-range': 'error',
    'regexp/no-useless-escape': 'error',
  },
};
