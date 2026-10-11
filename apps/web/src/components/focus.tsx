"use client";

import type { FocusView } from "@pienance/core";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface Focus {
  /** The single view on screen, or null for the overview. */
  readonly focused: FocusView | null;
  /** Shows a single view by its key, or the overview again for null or the key on screen. */
  readonly toggle?: (key: string | null) => void;
}

const FocusContext = createContext<Focus>({ focused: null });

/**
 * The overview or one single view (a slice, every month, one time), shared by the
 * pie, its legend, the explanation and the lists. The views come from core.
 */
export function FocusProvider({
  focuses,
  children,
}: {
  focuses: readonly FocusView[];
  children: ReactNode;
}) {
  const [key, setKey] = useState<string | null>(null);

  const toggle = useCallback((next: string | null) => {
    setKey((current) => (next === current ? null : next));
  }, []);

  const value = useMemo(
    () => ({ focused: focuses.find((focus) => focus.key === key) ?? null, toggle }),
    [focuses, key, toggle],
  );

  return <FocusContext value={value}>{children}</FocusContext>;
}

export function useFocus(): Focus {
  return useContext(FocusContext);
}
