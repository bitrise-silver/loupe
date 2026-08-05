import { createContext } from 'react';

import type { Registry } from './registry/registry';
import type { LoupeConfig } from './types';

export type LoupeMode = 'idle' | 'inspecting' | 'capturing' | 'annotating';

export interface LoupeContextValue {
  config: LoupeConfig & { enabled: boolean };
  mode: LoupeMode;
  /** Enter inspect mode (called by the floating bubble). */
  open(): void;
  /** Return to idle, discarding the in-progress capture. */
  cancel(): void;
  registry: Registry;
}

export const LoupeContext = createContext<LoupeContextValue | null>(null);
