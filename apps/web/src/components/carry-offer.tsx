"use client";

import {
  describeCarried,
  describeCarry,
  describeCarryOffer,
  droppedCarrySentence,
  type CarryOfferView,
  type PieView,
  type SliceView,
} from "@pienance/core";
import { Button } from "@pienance/ui/components/button";
import { FieldLabel, FieldLegend, FieldSet } from "@pienance/ui/components/field";
import { RadioGroup, RadioGroupItem } from "@pienance/ui/components/radio-group";
import { useState, useSyncExternalStore, useTransition } from "react";
import type { PieActions } from "@/server/pie-actions";
import { Answer, type Tone } from "./answer";

export type CarryActions = Pick<PieActions, "carryOver" | "dropCarry">;

interface Said {
  readonly tone: Tone;
  readonly sentence: string;
  /** Just carried: it can be undone for the rest of the visit. */
  readonly undoable?: boolean;
}

/** Dismissing the offer is this viewer's alone, for one month; it is never stored on the server. */
function dismissedKey(month: string): string {
  return `carry-dismissed:${month}`;
}

function readDismissed(month: string): boolean {
  try {
    return window.localStorage.getItem(dismissedKey(month)) === "yes";
  } catch {
    return false;
  }
}

function subscribe(changed: () => void): () => void {
  window.addEventListener("storage", changed);

  return () => window.removeEventListener("storage", changed);
}

/** Savings when there is one, else the last live slice. */
function likelySlice(slices: readonly SliceView[]): string {
  const live = slices.filter((slice) => !slice.retired);

  return (live.find((slice) => slice.name === "Savings") ?? live.at(-1))?.id ?? "";
}

/**
 * Asks whether to carry last month's leftover into a slice, while there is one to carry.
 * After carrying, it answers in one line with an undo for the rest of the visit.
 */
export function CarryOffer({
  offer,
  slices,
  actions,
}: {
  offer: CarryOfferView | null;
  slices: readonly SliceView[];
  actions: CarryActions;
}) {
  const [sliceId, setSliceId] = useState(() => likelySlice(slices));
  const [said, setSaid] = useState<Said | null>(null);
  const [hidden, setHidden] = useState(false);
  const [pending, startTransition] = useTransition();
  // Read only after hydration, so the block never flashes for a viewer who dismissed it.

  const dismissed = useSyncExternalStore(
    subscribe,
    () => (offer ? readDismissed(offer.month) : false),
    () => true,
  );

  function carry() {
    startTransition(async () => {
      const outcome = await actions.carryOver({ sliceId });

      if (!outcome.ok) return setSaid({ tone: "error", sentence: outcome.error });

      const name = outcome.value.carry?.sliceName ?? "";

      setSaid({ tone: "fits", sentence: describeCarried(name), undoable: true });
    });
  }

  function undo() {
    startTransition(async () => {
      const outcome = await actions.dropCarry();

      setSaid(
        outcome.ok
          ? { tone: "fits", sentence: droppedCarrySentence }
          : { tone: "error", sentence: outcome.error },
      );
    });
  }

  function dismiss() {
    if (!offer) return;

    try {
      window.localStorage.setItem(dismissedKey(offer.month), "yes");
    } catch {
      // Without storage it stays hidden for this visit only.
    }

    setHidden(true);
  }

  if (said?.undoable) {
    return (
      <div className="flex flex-wrap items-center gap-x-3" aria-busy={pending}>
        <Answer tone={said.tone}>{said.sentence}</Answer>
        <Button
          variant="link"
          className="h-11 px-0 underline decoration-berry"
          disabled={pending}
          onClick={undo}
          data-track="undo-carry"
        >
          Undo
        </Button>
      </div>
    );
  }

  if (!offer || dismissed || hidden) {
    return said ? <Answer tone={said.tone}>{said.sentence}</Answer> : null;
  }

  return (
    <section
      className="grid gap-4 rounded-lg border p-4"
      aria-labelledby="carry-heading"
      aria-busy={pending}
    >
      <p id="carry-heading" className="font-medium">
        {describeCarryOffer(offer)}
      </p>
      <FieldSet className="gap-2">
        <FieldLegend variant="label">Carry it into</FieldLegend>
        <RadioGroup
          name="carrySliceId"
          value={sliceId}
          onValueChange={setSliceId}
          className="flex flex-wrap gap-2"
        >
          {slices
            .filter((slice) => !slice.retired)
            .map((slice) => (
              <FieldLabel
                key={slice.id}
                htmlFor={`carry-${slice.id}`}
                className="h-11 w-auto cursor-pointer gap-2 rounded-full border px-4 whitespace-nowrap has-data-[state=checked]:border-foreground has-data-[state=checked]:bg-secondary"
              >
                <RadioGroupItem id={`carry-${slice.id}`} value={slice.id} />
                {slice.name}
              </FieldLabel>
            ))}
        </RadioGroup>
      </FieldSet>
      {said && <Answer tone={said.tone}>{said.sentence}</Answer>}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="lg" disabled={pending || !sliceId} onClick={carry} data-track="carry">
          Carry it
        </Button>
        <Button
          size="lg"
          variant="ghost"
          disabled={pending}
          onClick={dismiss}
          data-track="dismiss-carry"
        >
          Not this month
        </Button>
      </div>
    </section>
  );
}

/** Under the legend: where last month's leftover went, with a way to undo it this month. */
export function CarryNote({
  carry,
  actions,
}: {
  carry: NonNullable<PieView["carry"]>;
  actions?: Pick<PieActions, "dropCarry">;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
      <p>{describeCarry(carry)}</p>
      {actions && (
        <Button
          variant="link"
          className="h-11 px-0 text-sm underline decoration-berry"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const outcome = await actions.dropCarry();

              setError(outcome.ok ? null : outcome.error);
            })
          }
          data-track="undo-carry"
        >
          Undo the carry
        </Button>
      )}
      {error && <Answer tone="error">{error}</Answer>}
    </div>
  );
}
