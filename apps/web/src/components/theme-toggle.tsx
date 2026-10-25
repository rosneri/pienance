"use client";

import { cn } from "@pienance/ui/lib/utils";
import { useSyncExternalStore } from "react";
import { themeKey, themeOf, themes, type Theme } from "./theme";

const names: Record<Theme, string> = { system: "System", light: "Light", dark: "Dark" };

const listeners = new Set<() => void>();

function subscribe(changed: () => void): () => void {
  listeners.add(changed);
  window.addEventListener("storage", changed);

  return () => {
    listeners.delete(changed);
    window.removeEventListener("storage", changed);
  };
}

function readTheme(): Theme {
  try {
    return themeOf(window.localStorage.getItem(themeKey));
  } catch {
    return "system";
  }
}

function choose(theme: Theme): void {
  try {
    if (theme === "system") window.localStorage.removeItem(themeKey);
    else window.localStorage.setItem(themeKey, theme);
  } catch {
    // Without storage the choice lasts for this visit only.
  }

  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;

  for (const changed of listeners) changed();
}

/** Light, dark, or whatever the device says; kept in this browser only. */
export function ThemeToggle() {
  const current = useSyncExternalStore(subscribe, readTheme, () => "system" as const);

  return (
    <div role="group" aria-label="Colours" className="flex flex-wrap items-center gap-1">
      {themes.map((theme) => (
        <button
          key={theme}
          type="button"
          aria-pressed={current === theme}
          onClick={() => choose(theme)}
          data-track={`theme-${theme}`}
          className={cn(
            "h-11 rounded-full px-3 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
            current === theme && "bg-secondary text-foreground",
          )}
        >
          {names[theme]}
        </button>
      ))}
    </div>
  );
}
