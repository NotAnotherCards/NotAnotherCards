const { defineConfig } = require('eslint/config');

const js = require('@eslint/js');

const { FlatCompat } = require('@eslint/eslintrc');

const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const betterTailwindcss = require('eslint-plugin-better-tailwindcss');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

module.exports = defineConfig([
  {
    extends: compat.extends('@repo/eslint-config/index.js'),
  },
  // Type-aware rules need the TypeScript program, same as web (#121). Scoped
  // to the source dirs so config files stay outside the project service.
  {
    files: ['{app,components,lib}/**/*.{ts,tsx}'],
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
      'better-tailwindcss': { tailwindConfig: 'tailwind.config.js' },
    },
    rules: {
      // A missing space fuses two utilities into one token Tailwind cannot
      // match, silently killing both (#123). NativeWind cannot report it at
      // runtime either.
      'better-tailwindcss/no-unknown-classes': 'error',
      // A dropped promise from an async store method reports success the
      // database never agreed to (#122); same risk on mobile.
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
  // Tests and mocks are linted too, with the two relaxations they need.
  {
    files: ['{__tests__,__mocks__}/**/*.{ts,tsx}'],
    rules: {
      // jest.mock factories are hoisted above imports, so the module being
      // mocked has to be pulled in with require() inside the factory.
      '@typescript-eslint/no-require-imports': 'off',
      // Parameters kept for signature shape are prefixed with an underscore.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
]);
