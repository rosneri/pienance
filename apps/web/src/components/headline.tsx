import type { ReactNode } from "react";

export function Headline({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h1 id={id} className="max-w-[14ch] text-[clamp(2.25rem,4vw+1.25rem,4rem)] leading-[1.08]">
      {children}
    </h1>
  );
}
