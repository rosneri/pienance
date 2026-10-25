"use client";

import { describeMoved, type BiteView, type SliceView } from "@pienance/core";
import { Button } from "@pienance/ui/components/button";
import { cn } from "@pienance/ui/lib/utils";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import type { PieActions } from "@/server/pie-actions";
import { Answer } from "./answer";
import { useFocus } from "./focus";

/** What a row shows under its options: nothing, the choices, or a put back to confirm. */
type Open = { readonly id: string; readonly confirming: boolean } | null;

interface Said {
  readonly id: string;
  readonly error: boolean;
  readonly sentence: string;
}

const noSlices: readonly SliceView[] = [];

export function BiteList({
  bites,
  heading = "Eaten this month",
  empty = "Not a crumb yet.",
  composer,
  importable = false,
  swept = null,
  slices = noSlices,
  actions,
}: {
  bites: readonly BiteView[];
  heading?: string;
  empty?: string;
  /** The first row, for adding a bite; absent on a month that is over. */
  composer?: ReactNode;
  /** Links to importing a bank statement, for this month's bites. */
  importable?: boolean;
  /** "Swept this month: a sliver of Savings.", when bites were rounded up. */
  swept?: string | null;
  /** Where a bite can be moved to. */
  slices?: readonly SliceView[];
  /** Without them (a month that is over) the rows are read-only. */
  actions?: Pick<PieActions, "putBackBite" | "putBackSpread" | "moveBite">;
}) {
  const { focused } = useFocus();
  const [open, setOpen] = useState<Open>(null);
  const [said, setSaid] = useState<Said | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /** Where focus goes once a put back bite leaves the list: a bite's options, or the heading. */
  const focusAfter = useRef<string | null>(null);
  const [, startTransition] = useTransition();
  const list = useRef<HTMLUListElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shown = focused ? bites.filter((bite) => focused.biteIds.includes(bite.id)) : bites;

  useEffect(() => {
    if (focusAfter.current === null || shown.some((bite) => bite.id === busy)) return;

    const next = list.current?.querySelector<HTMLElement>(`[data-options="${focusAfter.current}"]`);

    (next ?? headingRef.current)?.focus();
    focusAfter.current = null;
  }, [shown, busy]);

  // A view across slices without bites (every month) has nothing to list here.
  if (!composer && focused?.kind === "recurrence" && shown.length === 0) return null;

  function putBack(bite: BiteView) {
    if (!actions) return;

    const next = shown[shown.indexOf(bite) + 1] ?? shown[shown.indexOf(bite) - 1];

    setBusy(bite.id);
    focusAfter.current = next?.id ?? "";
    startTransition(async () => {
      // A spread with parts to come goes with them; earlier parts stay.
      const outcome =
        bite.spread && bite.spread.toCome > 0
          ? await actions.putBackSpread({ spreadId: bite.spread.id })
          : await actions.putBackBite({ biteId: bite.id });

      setOpen(null);

      if (outcome.ok) return setSaid(null);

      focusAfter.current = null;
      setSaid({ id: bite.id, error: true, sentence: outcome.error });
      setBusy(null);
    });
  }

  function move(bite: BiteView, slice: SliceView) {
    if (!actions) return;

    setBusy(bite.id);
    startTransition(async () => {
      const outcome = await actions.moveBite({ biteId: bite.id, sliceId: slice.id });

      setOpen(null);
      setBusy(null);
      setSaid(
        outcome.ok
          ? { id: bite.id, error: false, sentence: describeMoved(outcome.value) }
          : { id: bite.id, error: true, sentence: outcome.error },
      );
    });
  }

  return (
    <section className="grid content-start gap-4" aria-labelledby="bites-heading">
      <h2 id="bites-heading" ref={headingRef} tabIndex={-1} className="text-2xl outline-none">
        {heading}
        {focused && <span className="text-muted-foreground"> · {focused.name}</span>}
      </h2>
      <ul ref={list} className="grid">
        {composer}
        {shown.map((bite) => {
          const name = bite.note || "Something";
          const isOpen = open?.id === bite.id;
          const pending = busy === bite.id;
          const toCome = bite.spread?.toCome ?? 0;
          const putBackWords = toCome > 0 ? `Put back this and the ${toCome} to come` : "Put back";

          return (
            <li
              key={bite.id}
              className={cn("grid gap-2 border-b", actions ? "py-1.5" : "py-3")}
              aria-busy={pending}
            >
              <div
                className={cn(
                  "flex items-center justify-between gap-4",
                  actions && "min-h-11",
                  pending && "opacity-50",
                )}
              >
                <span className="grid">
                  <span>
                    {name}
                    {bite.spread && (
                      <span className="text-muted-foreground"> · {bite.spread.words}</span>
                    )}
                  </span>
                  {toCome > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {toCome === 1 ? "1 more month" : `${toCome} more months`}
                    </span>
                  )}
                </span>
                <span className="ms-auto text-end text-muted-foreground tabular-nums">
                  {bite.portion} of {bite.sliceName}
                </span>
                {actions && (
                  <Button
                    variant="ghost"
                    className="size-11 text-lg"
                    aria-label={`Options for ${name}`}
                    aria-expanded={isOpen}
                    disabled={pending}
                    data-options={bite.id}
                    onClick={() => setOpen(isOpen ? null : { id: bite.id, confirming: false })}
                    data-track="bite-options"
                  >
                    …
                  </Button>
                )}
              </div>

              {isOpen && !open.confirming && (
                <div className="flex flex-wrap justify-end gap-2 pb-2">
                  {slices
                    .filter((slice) => slice.id !== bite.sliceId)
                    .map((slice) => (
                      <Button
                        key={slice.id}
                        variant="outline"
                        className="h-11"
                        disabled={pending}
                        onClick={() => move(bite, slice)}
                        data-track="move-bite"
                      >
                        Move to {slice.name}
                      </Button>
                    ))}
                  <Button
                    variant="outline"
                    className="h-11 text-destructive"
                    disabled={pending}
                    onClick={() => setOpen({ id: bite.id, confirming: true })}
                    data-track="put-back-options"
                  >
                    {putBackWords}
                  </Button>
                </div>
              )}

              {isOpen && open.confirming && (
                <div className="flex flex-wrap items-center justify-end gap-2 pb-2">
                  <span className="me-auto">
                    {toCome > 0 ? `${putBackWords}?` : `Put back ${name}?`}
                  </span>
                  <Button
                    variant="outline"
                    className="h-11"
                    autoFocus
                    disabled={pending}
                    onClick={() => setOpen(null)}
                  >
                    Keep
                  </Button>
                  <Button
                    variant="destructive"
                    className="h-11"
                    disabled={pending}
                    onClick={() => putBack(bite)}
                    data-track="put-back-bite"
                  >
                    Put back
                  </Button>
                </div>
              )}

              {said?.id === bite.id && (
                <div className="pb-2">
                  <Answer tone={said.error ? "error" : "fits"}>{said.sentence}</Answer>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && (
        <p className="max-w-[60ch] text-muted-foreground">
          {focused && bites.length > 0 ? `Nothing here for ${focused.name}.` : empty}
        </p>
      )}
      {swept && <p className="text-sm text-muted-foreground">{swept}</p>}
      {importable && (
        <Link
          href="/import"
          className="w-fit text-sm whitespace-nowrap underline decoration-berry underline-offset-4"
        >
          Bring in a statement
        </Link>
      )}
    </section>
  );
}
