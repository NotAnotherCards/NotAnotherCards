const {
    defineConfig,
} = require("eslint/config");

const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = defineConfig([
    {
        ignores: ["apps/web/src/routeTree.gen.ts"],
    },
    {
        extends: compat.extends("@repo/eslint-config/index.js"),
    },
]);
