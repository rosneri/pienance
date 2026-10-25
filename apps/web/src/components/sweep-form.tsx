"use client";

import { describeSweep, sweepExample, type ResliceView } from "@pienance/core";
import { Checkbox } from "@pienance/ui/components/checkbox";
import { FieldLabel, FieldLegend, FieldSet } from "@pienance/ui/components/field";
import { RadioGroup, RadioGroupItem } from "@pienance/ui/components/radio-group";
import { useState, useTransition } from "react";
import type { PieActions } from "@/server/pie-actions";
import { Answer, type Tone } from "./answer";
import { currencySymbol } from "./currency-symbol";

const pill =
  "h-11 w-auto cursor-pointer gap-2 rounded-full border px-4 whitespace-nowrap has-data-[state=checked]:border-foreground has-data-[state=checked]:bg-secondary";

/** Savings when there is one, else the last slice. */
function likelySlice(view: ResliceView): string {
  return (view.slices.find((slice) => slice.name === "Savings") ?? view.slices.at(-1))?.id ?? "";
}

/**
 * "Round bites up": the difference between a bite and its next whole step counts as eaten
 * from one slice, usually Savings. Every change applies at once.
 */
export function SweepForm({
  view,
  setSweep,
}: {
  view: ResliceView;
  setSweep: PieActions["setSweep"];
}) {
  const [on, setOn] = useState(view.sweep !== undefined);
  const [sliceId, setSliceId] = useState(view.sweep?.sliceId ?? likelySlice(view));
  const [step, setStep] = useState(view.sweep?.step ?? view.sweepSteps[0] ?? "1");
  const [said, setSaid] = useState<{ tone: Tone; sentence: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const symbol = currencySymbol(view.currency);
  const example = sweepExample(view.currency, step);
  const sliceName = view.slices.find((slice) => slice.id === sliceId)?.name ?? "";

  function apply(next: { on: boolean; sliceId: string; step: string }) {
    startTransition(async () => {
      const outcome = await setSweep(
        next.on ? { sliceId: next.sliceId, step: next.step } : { off: true },
      );

      setSaid(
        outcome.ok
          ? { tone: "fits", sentence: describeSweep(outcome.value) }
          : { tone: "error", sentence: outcome.error },
      );
    });
  }

  return (
    <section className="grid max-w-xl gap-4" aria-labelledby="sweep-heading" aria-busy={pending}>
      <h2 id="sweep-heading" className="text-2xl">
        Sweep
      </h2>
      <FieldLabel htmlFor="sweep-on" className="h-11 w-fit cursor-pointer gap-3">
        <Checkbox
          id="sweep-on"
          checked={on}
          disabled={pending}
          onCheckedChange={(checked) => {
            setOn(checked === true);
            apply({ on: checked === true, sliceId, step });
          }}
          data-track="sweep-on"
        />
        Round bites up
      </FieldLabel>

      {on && (
        <>
          <FieldSet className="gap-2">
            <FieldLegend variant="label">into</FieldLegend>
            <RadioGroup
              name="sweepSliceId"
              value={sliceId}
              onValueChange={(next) => {
                setSliceId(next);
                apply({ on, sliceId: next, step });
              }}
              className="flex flex-wrap gap-2"
            >
              {view.slices.map((slice) => (
                <FieldLabel key={slice.id} htmlFor={`sweep-${slice.id}`} className={pill}>
                  <RadioGroupItem id={`sweep-${slice.id}`} value={slice.id} />
                  {slice.name}
                </FieldLabel>
              ))}
            </RadioGroup>
          </FieldSet>

          <FieldSet className="gap-2">
            <FieldLegend variant="label">to the next</FieldLegend>
            <RadioGroup
              name="sweepStep"
              value={step}
              onValueChange={(next) => {
                setStep(next);
                apply({ on, sliceId, step: next });
              }}
              className="flex flex-wrap gap-2"
            >
              {view.sweepSteps.map((choice) => (
                <FieldLabel key={choice} htmlFor={`step-${choice}`} className={pill}>
                  <RadioGroupItem id={`step-${choice}`} value={choice} />
                  <span className="tabular-nums">
                    {choice} {symbol}
                  </span>
                </FieldLabel>
              ))}
            </RadioGroup>
          </FieldSet>

          <p className="text-muted-foreground tabular-nums">
            A {example.bite} {symbol} bite sweeps {example.swept} {symbol} into {sliceName}.
          </p>
        </>
      )}

      {said && <Answer tone={said.tone}>{said.sentence}</Answer>}
    </section>
  );
}
