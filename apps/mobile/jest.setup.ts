// Reanimated and its worklets runtime need native code; tests use their JS
// mocks.
jest.mock('react-native-worklets', () =>
  require('react-native-worklets/lib/module/mock'),
);
// The mock lacks useReducedMotion; tests run with motion on.
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
