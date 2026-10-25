import type { ReactNode } from "react";
import { ThemeToggle } from "./theme-toggle";

export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 pt-4 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(2.5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] lg:gap-16 lg:pt-6">
      {children}
      <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-4 text-sm text-muted-foreground">
        <p>pienance — proportions, not numbers.</p>
        <ThemeToggle />
      </footer>
    </div>
  );
}
