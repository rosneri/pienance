import type { Verdict } from "@pienance/core";
import { cn } from "@pienance/ui/lib/utils";

export type Tone = Verdict | "error";

const toneClass: Record<Tone, string> = {
  fits: "text-foreground",
  tight: "text-tight",
  overflows: "text-destructive",
  error: "text-destructive",
};

/** The one line that answers a form: a verdict, an error, or "Weighing…". */
export function Answer({ tone, children }: { tone: Tone | undefined; children: React.ReactNode }) {
  return (
    <p role="status" className={cn("min-h-6", tone ? toneClass[tone] : "text-foreground")}>
      {children}
    </p>
  );
}
