'use client';

import { createContext, useContext, type ReactNode } from 'react';

export type AppMode = 'mock' | 'live';

interface ModeValue {
  mode: AppMode;
  isLive: boolean;
  isMock: boolean;
}

const ModeContext = createContext<ModeValue>({ mode: 'mock', isLive: false, isMock: true });

/**
 * Provides the server-resolved FOSSAPAY_MODE to client components.
 * Use `useMode().isMock` to decide whether sample data / simulate controls may be shown.
 * In live mode there must be no pre-filled sample data and no simulate controls.
 */
export function ModeProvider({ mode, children }: { mode: AppMode; children: ReactNode }) {
  return (
    <ModeContext.Provider value={{ mode, isLive: mode === 'live', isMock: mode !== 'live' }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode(): ModeValue {
  return useContext(ModeContext);
}
