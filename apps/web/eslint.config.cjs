const {
    defineConfig,
} = require("eslint/config");

const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const betterTailwindcss = require("eslint-plugin-better-tailwindcss");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = defineConfig([
    {
        ignores: ["src/routeTree.gen.ts"],
    },
    {
        extends: compat.extends("@repo/eslint-config/index.js"),
    },
    // Type-aware rules need the TypeScript program (#121). Scoped to src so
    // config files stay outside the project service.
    {
        files: ["src/**/*.{ts,tsx}"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                projectService: true,
                tsconfigRootDir: __dirname,
            },
        },
        plugins: {
            "@typescript-eslint": tsPlugin,
            "better-tailwindcss": betterTailwindcss,
        },
        settings: {
            "better-tailwindcss": {
                entryPoint: "src/style.css",
            },
        },
        rules: {
            // A dropped promise from an async store method reports success the
            // database never agreed to (#122); make it an error, not a habit.
            "@typescript-eslint/no-floating-promises": "error",
            // A missing space fuses two utilities into one token Tailwind
            // cannot match, silently killing both (#123).
            "better-tailwindcss/no-unknown-classes": "error",
        },
    },
]);
