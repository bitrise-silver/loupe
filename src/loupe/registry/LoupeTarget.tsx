import { useContext, useEffect, useId, useRef, type ComponentRef, type ReactNode } from 'react';
import { View } from 'react-native';

import { LoupeContext } from '../context';
import type { Rect } from '../types';

interface Props {
  /** Human-friendly name shown to the reviewer / attached to the anchor. */
  name?: string;
  testID?: string;
  children: ReactNode;
  // Injected by babel-plugin-loupe-source at the call site → "app/Foo.tsx:42".
  'data-loupe-source'?: string;
}

/**
 * Registers its subtree as a feedback anchor. Renders a wrapper View with `collapsable={false}`
 * so the native view is always measurable (layout-only views get flattened out otherwise —
 * see docs/mobile-architecture.md). The source string comes from the Babel plugin's injected
 * prop, so it is release-safe (no React internals).
 */
export function LoupeTarget({ name, testID, children, ...rest }: Props) {
  const ctx = useContext(LoupeContext);
  const ref = useRef<ComponentRef<typeof View>>(null);
  const id = useId();
  const source = rest['data-loupe-source'] ?? null;

  useEffect(() => {
    if (!ctx) return;

    const measure = () =>
      new Promise<Rect | null>((resolve) => {
        const node = ref.current;
        if (!node) return resolve(null);
        node.measureInWindow((x, y, width, height) => {
          if (!width && !height) return resolve(null);
          resolve({ x, y, width, height });
        });
      });

    return ctx.registry.register({ id, name, testID: testID ?? source ?? undefined, source, measure });
  }, [ctx, id, name, testID, source]);

  return (
    <View ref={ref} collapsable={false} testID={testID}>
      {children}
    </View>
  );
}
