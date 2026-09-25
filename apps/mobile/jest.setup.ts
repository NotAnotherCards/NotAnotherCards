// Reanimated's worklets need the native runtime; tests use its JS mock.
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);
