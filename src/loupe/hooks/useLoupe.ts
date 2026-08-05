import { useContext } from 'react';

import { LoupeContext, type LoupeContextValue } from '../context';

/** Access the Loupe controller. Must be used inside <LoupeProvider>. */
export function useLoupe(): LoupeContextValue {
  const ctx = useContext(LoupeContext);
  if (!ctx) {
    throw new Error('useLoupe() must be used inside <LoupeProvider>.');
  }
  return ctx;
}
