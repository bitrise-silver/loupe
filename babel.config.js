module.exports = function (api) {
  api.cache(true);

  // Loupe's source-injection plugin runs everywhere EXCEPT production by default, so it
  // never bloats a store build. Flip this if you ship a dedicated instrumented QA build
  // and want `file:line` anchoring in a non-dev binary (see docs/mobile-architecture.md).
  const isProduction =
    process.env.BABEL_ENV === 'production' || process.env.NODE_ENV === 'production';

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Injects data-loupe-source="app/Foo.tsx:42" onto host JSX elements (user code only),
      // so a tapped element can be mapped back to source in a release-safe way.
      ...(!isProduction ? [require.resolve('./babel-plugin-loupe-source')] : []),

      // Reanimated v4 ships its Babel plugin inside react-native-worklets, and it MUST be last.
      // If you are on Reanimated v3, replace this with 'react-native-reanimated/plugin'.
      'react-native-worklets/plugin',
    ],
  };
};
