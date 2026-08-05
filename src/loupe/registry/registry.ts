import type { Rect } from '../types';

// The release-safe half of "which part did they tap?".
// Each LoupeTarget registers a measurable node; on a tap we measure everyone and pick the
// smallest rect that contains the point. This works in production (no React internals),
// unlike getInspectorDataForViewAtPoint which is dev-only. See docs/mobile-architecture.md.

export interface RegistryEntry {
  id: string;
  name?: string;
  testID?: string;
  source?: string | null; // file:line from the Babel plugin (data-loupe-source) or testID
  measure: () => Promise<Rect | null>;
}

export interface HitResult {
  id: string;
  name?: string;
  testID?: string;
  source?: string | null;
  rect: Rect;
}

const area = (r: Rect) => r.width * r.height;

export class Registry {
  private entries = new Map<string, RegistryEntry>();

  register(entry: RegistryEntry): () => void {
    this.entries.set(entry.id, entry);
    return () => {
      this.entries.delete(entry.id);
    };
  }

  size(): number {
    return this.entries.size;
  }

  /** Hit-test a window-space point; returns the smallest (most specific) containing target. */
  async hitTest(x: number, y: number): Promise<HitResult | null> {
    const measured = await Promise.all(
      [...this.entries.values()].map(async (e) => {
        const rect = await e.measure();
        return rect ? { e, rect } : null;
      }),
    );

    let best: { e: RegistryEntry; rect: Rect } | null = null;
    for (const m of measured) {
      if (!m) continue;
      const { rect } = m;
      const inside =
        x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
      if (!inside) continue;
      if (!best || area(rect) < area(best.rect)) best = m;
    }

    if (!best) return null;
    return {
      id: best.e.id,
      name: best.e.name,
      testID: best.e.testID,
      source: best.e.source,
      rect: best.rect,
    };
  }
}

export const createRegistry = () => new Registry();
