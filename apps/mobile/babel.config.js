module.exports = function (api) {
  const isTest = api.env('test')
  api.cache.using(() => process.env.NODE_ENV)

  // NativeWind's JSX transform clashes with jest.mock hoisting, and tests
  // assert on text, not styles. Skip the NativeWind transform under jest.
  const presets = [
    ['babel-preset-expo', isTest ? {} : { jsxImportSource: 'nativewind' }],
  ]
  if (!isTest) presets.push('nativewind/babel')

  return { presets }
}
