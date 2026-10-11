"use client";

import type { StapleView } from "@pienance/core";
import { Button } from "@pienance/ui/components/button";
import { cn } from "@pienance/ui/lib/utils";
import { useState, useTransition } from "react";
import type { PieActions } from "@/server/pie-actions";
import { Answer } from "./answer";
import { useFocus } from "./focus";

/** What a row shows under its options: nothing, the choices, or a stop to confirm. */
type Open = { readonly id: string; readonly confirming: boolean } | null;

/**
 * "Every month": the pantry, one row per staple. Without actions (a past month) the
 * rows are read-only.
 */
export function StapleList({
  staples,
  monthName,
  actions,
  onChange,
}: {
  staples: readonly StapleView[];
  /** The served month, e.g. "October": stopping a staple keeps it until its end. */
  monthName: string;
  actions?: Pick<PieActions, "dropStaple">;
  /** Asked to change a staple's amount: the weigh form takes it from here. */
  onChange?: (staple: StapleView) => void;
}) {
  const [open, setOpen] = useState<Open>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { focused } = useFocus();

  const shown = focused
    ? staples.filter((staple) => focused.stapleIds.includes(staple.id))
    : staples;

  if (shown.length === 0) return null;

  function drop(staple: StapleView) {
    if (!actions) return;

    startTransition(async () => {
      const outcome = await actions.dropStaple({ stapleId: staple.id });

      setError(outcome.ok ? null : outcome.error);
      setOpen(null);
    });
  }

  return (
    <section className="grid content-start gap-4" aria-labelledby="staples-heading">
      <h2 id="staples-heading" className="text-2xl">
        Every month
        {focused?.kind === "slice" && (
          <span className="text-muted-foreground"> · {focused.name}</span>
        )}
      </h2>
      <ul className="grid">
        {shown.map((staple) => {
          const name = staple.note || "Something";
          const stop = staple.stockedThisMonth ? "Remove" : `Stop after ${monthName}`;
          const isOpen = open?.id === staple.id;
          const canStop = actions !== undefined && staple.endsAfter === undefined;

          return (
            <li key={staple.id} className="grid gap-2 border-b py-1.5">
              <div
                className={cn(
                  "flex min-h-11 items-center justify-between gap-4",
                  staple.endsAfter && "text-muted-foreground",
                )}
              >
                <span>{name}</span>
                <span className="ms-auto text-end text-muted-foreground">
                  {staple.endsAfter
                    ? `Ends after ${staple.endsAfter}`
                    : `${staple.portionWords} of ${staple.sliceName}`}
                </span>
                {canStop && (
                  <Button
                    variant="ghost"
                    className="size-11 text-lg"
                    aria-label={`Options for ${name}`}
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : { id: staple.id, confirming: false })}
                    data-track="staple-options"
                  >
                    …
                  </Button>
                )}
              </div>

              {isOpen && !open.confirming && (
                <div className="flex flex-wrap justify-end gap-2 pb-2">
                  <Button
                    variant="outline"
                    className="h-11"
                    onClick={() => setOpen({ id: staple.id, confirming: true })}
                    data-track="stop-staple"
                  >
                    {stop}
                  </Button>
                  {onChange && (
                    <Button
                      variant="outline"
                      className="h-11"
                      onClick={() => {
                        setOpen(null);
                        onChange(staple);
                      }}
                      data-track="change-staple"
                    >
                      Change amount
                    </Button>
                  )}
                </div>
              )}

              {isOpen && open.confirming && (
                <div className="flex flex-wrap items-center justify-end gap-2 pb-2">
                  <span className="me-auto">
                    {staple.stockedThisMonth ? `Remove ${name}?` : `${stop}?`}
                  </span>
                  <Button
                    variant="outline"
                    className="h-11"
                    disabled={pending}
                    onClick={() => setOpen(null)}
                  >
                    Keep it
                  </Button>
                  <Button
                    className="h-11"
                    disabled={pending}
                    onClick={() => drop(staple)}
                    data-track="drop-staple"
                  >
                    {staple.stockedThisMonth ? "Remove" : "Stop"}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && <Answer tone="error">{error}</Answer>}
    </section>
  );
}
