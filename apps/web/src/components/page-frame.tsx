import type { ReactNode } from "react";

export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 pt-4 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(2.5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] lg:gap-16 lg:pt-6">
      {children}
      <footer className="border-t pt-4 text-sm text-muted-foreground">
        pienance — proportions, not numbers.
      </footer>
    </div>
  );
}
