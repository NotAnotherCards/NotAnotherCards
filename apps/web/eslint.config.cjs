const { defineConfig } = require('eslint/config');

const js = require('@eslint/js');

const { FlatCompat } = require('@eslint/eslintrc');

const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const betterTailwindcss = require('eslint-plugin-better-tailwindcss');
const i18next = require('eslint-plugin-i18next');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

module.exports = defineConfig([
  {
    ignores: ['src/routeTree.gen.ts'],
  },
  {
    extends: compat.extends('@repo/eslint-config/index.js'),
  },
  // Type-aware rules need the TypeScript program (#121). Scoped to src so
  // config files stay outside the project service.
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'better-tailwindcss': betterTailwindcss,
    },
    settings: {
      'better-tailwindcss': {
        entryPoint: 'src/style.css',
      },
    },
    rules: {
      // A dropped promise from an async store method reports success the
      // database never agreed to (#122); make it an error, not a habit.
      '@typescript-eslint/no-floating-promises': 'error',
      // A missing space fuses two utilities into one token Tailwind
      // cannot match, silently killing both (#123).
      'better-tailwindcss/no-unknown-classes': 'error',
      // An any read off res.json() rendered a TypeError instead of the
      // fallback message (#219); these three keep any at the boundary
      // from spreading (#220).
      '@typescript-eslint/no-unsafe-type-assertion': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
    },
  },
  // User-facing JSX, including accessibility labels and template strings.
  // Tests contain fixtures; structural attributes are not translated.
  {
    files: ['src/**/*.tsx'],
    ignores: ['src/test/**', 'src/**/__tests__/**', 'src/**/*.{test,spec}.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          'should-validate-template': true,
          words: {
            exclude: ['NotAnotherCards', '[0-9!-/:-@[-`{-~✓●✕○▼•]+'],
          },
          'jsx-attributes': {
            exclude: [
              'className',
              'style',
              'type',
              'key',
              'id',
              'width',
              'height',
              'role',
              'src',
              'href',
              'to',
              'target',
              'rel',
              'name',
              'value',
              'htmlFor',
              'autoComplete',
              'inputMode',
              'pattern',
              'data-.*',
              'aria-live',
              'aria-atomic',
              'aria-haspopup',
              'aria-describedby',
              'aria-labelledby',
              'on[A-Z].*',
              'footerLinkTo',
              'indicatorClassName',
              'testId',
              'errorId',
            ],
          },
        },
      ],
    },
  },
  // Tests cast mocks as a matter of course; that is not what the unsafe
  // rules are for (#220).
  {
    files: ['src/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unsafe-type-assertion': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
]);
