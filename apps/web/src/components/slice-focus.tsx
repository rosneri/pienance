"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export interface FocusedSlice {
  readonly id: string;
  readonly name: string;
}

interface SliceFocus {
  /** The slice the person tapped, or null to show every slice. */
  readonly focused: FocusedSlice | null;
  /** Focuses a slice, or shows them all again when it is already focused or null. */
  readonly toggle?: (slice: FocusedSlice | null) => void;
}

const Focus = createContext<SliceFocus>({ focused: null });

/** One focused slice, shared by the pie, its legend, the explanation and the lists. */
export function SliceFocusProvider({ children }: { children: ReactNode }) {
  const [focused, setFocused] = useState<FocusedSlice | null>(null);

  const toggle = useCallback((slice: FocusedSlice | null) => {
    setFocused((current) => (slice === null || current?.id === slice.id ? null : slice));
  }, []);

  const value = useMemo(() => ({ focused, toggle }), [focused, toggle]);

  return <Focus value={value}>{children}</Focus>;
}

export function useSliceFocus(): SliceFocus {
  return useContext(Focus);
}
