// Metro must see the whole pnpm workspace: watch the repo root and
// resolve from both the app's and the root's node_modules, so
// workspace-linked packages (@repo/schemas, ...) load.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 16px per rem, as on web. nativewind defaults to 14, which scales every
// rem-based class down against the web client the screens are meant to match.
module.exports = withNativeWind(config, {
  input: './global.css',
  inlineRem: 16,
});
