const path = require('path');

/**
 * babel-plugin-loupe-source
 *
 * Injects `data-loupe-source="app/Foo.tsx:42"` onto JSX elements in your own code (skips
 * node_modules). Because it's an ordinary prop, it survives into the Hermes release bundle
 * (React 19 removed the fiber debug source, so we do NOT rely on React internals). At runtime,
 * <LoupeTarget> reads its own injected prop to record a release-safe source anchor.
 *
 * Enable in dev via babel.config.js; leave it on for an instrumented QA build if you want
 * file:line anchoring in a non-dev binary. See docs/mobile-architecture.md.
 *
 * NOTE (scaffold): this injects on every JSX element, including host components (View/Text),
 * which receive an extra ignored prop. A production refinement is to scope injection (e.g. only
 * composite components, or strip the prop from known host elements) to avoid unknown-prop noise.
 */
module.exports = function loupeSourcePlugin({ types: t }) {
  const ATTR = 'data-loupe-source';

  return {
    name: 'loupe-source',
    visitor: {
      JSXOpeningElement(nodePath, state) {
        const filename = state.file.opts.filename || '';
        if (!filename || filename.includes('node_modules')) return;

        const attrs = nodePath.node.attributes;
        const already = attrs.some(
          (a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name, { name: ATTR }),
        );
        if (already) return;

        const loc = nodePath.node.loc;
        if (!loc || !loc.start) return;

        const root = state.file.opts.root || process.cwd();
        const rel = path.relative(root, filename) || filename;

        attrs.push(
          t.jsxAttribute(t.jsxIdentifier(ATTR), t.stringLiteral(`${rel}:${loc.start.line}`)),
        );
      },
    },
  };
};
