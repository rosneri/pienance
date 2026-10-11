"use client";

import {
  describeStaple,
  describeTaken,
  describeVerdict,
  putBackSentence,
  type SliceView,
  type StapleView,
  type WeighingView,
} from "@pienance/core";
import { Button } from "@pienance/ui/components/button";
import { Checkbox } from "@pienance/ui/components/checkbox";
import { FieldLabel, FieldLegend, FieldSet } from "@pienance/ui/components/field";
import { Input } from "@pienance/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@pienance/ui/components/radio-group";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import type { PieActions } from "@/server/pie-actions";
import { Answer, type Tone } from "./answer";
import { currencySymbol } from "./currency-symbol";
import { useFocus } from "./focus";

export type ComposerActions = Pick<
  PieActions,
  "weighBite" | "takeBite" | "putBackBite" | "stockStaple"
>;

/** How long typing must pause before the bite is weighed. */
export const weighDelay = 300;

interface Said {
  readonly tone: Tone;
  readonly sentence: string;
}

/**
 * The first row of the bite list: "+ Add a bite", which opens into a line item.
 * While a price is typed it weighs the bite live, showing its portion of the slice
 * and the verdict, so "is it worth it?" is answered before the bite is taken.
 */
export function BiteComposer({
  slices,
  currency,
  actions,
  changing,
}: {
  slices: readonly SliceView[];
  currency: string;
  actions: ComposerActions;
  /** A staple whose amount is being changed: the row opens with its note, slice and amount. */
  changing?: StapleView | null;
}) {
  const { focused } = useFocus();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [sliceId, setSliceId] = useState(slices[0]?.id ?? "");
  const [everyMonth, setEveryMonth] = useState(false);
  const [replaces, setReplaces] = useState<StapleView | null>(null);
  const [weighing, setWeighing] = useState<WeighingView | null>(null);
  const [said, setSaid] = useState<Said | null>(null);
  /** The last bite taken: it can be put back until the next one is weighed. */
  const [undoable, setUndoable] = useState<string | null>(null);
  const [taken, setTaken] = useState(changing);
  const [pending, startTransition] = useTransition();
  const amountInput = useRef<HTMLInputElement>(null);
  const row = useRef<HTMLLIElement>(null);

  // A new staple to change opens the row with it, once.
  if (changing !== taken) {
    setTaken(changing);

    if (changing) {
      setOpen(true);
      setNote(changing.note);
      setAmount(changing.amount);
      setSliceId(changing.sliceId);
      setEveryMonth(true);
      setReplaces(changing);
    }
  }

  useEffect(() => {
    if (!changing) return;

    row.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    amountInput.current?.focus({ preventScroll: true });
  }, [changing]);

  // Weighs the bite as it is typed; a later answer always replaces an earlier one.
  useEffect(() => {
    if (!open || amount.trim() === "") return;

    let current = true;

    const timer = setTimeout(async () => {
      const outcome = await actions.weighBite({ sliceId, amount });

      if (!current) return;

      setWeighing(outcome.ok ? outcome.value : null);
      setSaid(outcome.ok ? null : { tone: "error", sentence: outcome.error });
    }, weighDelay);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [open, amount, sliceId, actions]);

  function start() {
    setOpen(true);
    setSaid(null);
    setUndoable(null);

    // A focused slice is the likely one.
    if (focused?.kind === "slice" && focused.sliceId) setSliceId(focused.sliceId);
  }

  function reset() {
    setNote("");
    setAmount("");
    setEveryMonth(false);
    setReplaces(null);
    setWeighing(null);
  }

  function close() {
    reset();
    setSaid(null);
    setOpen(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const bite = { sliceId, amount, note };

    startTransition(async () => {
      if (everyMonth) {
        const outcome = await actions.stockStaple({
          ...bite,
          ...(replaces && { replaces: replaces.id }),
        });

        if (!outcome.ok) return setSaid({ tone: "error", sentence: outcome.error });

        reset();
        setOpen(false);
        setSaid({ tone: "fits", sentence: describeStaple(outcome.value) });

        return;
      }

      const outcome = await actions.takeBite(bite);

      if (!outcome.ok) return setSaid({ tone: "error", sentence: outcome.error });

      reset();
      setOpen(false);
      setSaid({ tone: "fits", sentence: describeTaken(outcome.value) });
      setUndoable(outcome.value.id);
    });
  }

  function putBack(biteId: string) {
    startTransition(async () => {
      const outcome = await actions.putBackBite({ biteId });

      setUndoable(null);
      setSaid(
        outcome.ok
          ? { tone: "fits", sentence: putBackSentence }
          : { tone: "error", sentence: outcome.error },
      );
    });
  }

  if (!open) {
    return (
      <li className="grid gap-1 border-b">
        <button
          type="button"
          onClick={start}
          className="flex min-h-11 w-full items-center gap-3 py-2 text-start text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          data-track="add-bite"
        >
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-full border text-lg leading-none"
          >
            +
          </span>
          Add a bite
        </button>
        {said && (
          <div className="flex flex-wrap items-center gap-x-3 pb-2" aria-busy={pending}>
            <Answer tone={said.tone}>{said.sentence}</Answer>
            {undoable && (
              <Button
                variant="link"
                className="h-11 px-0"
                disabled={pending}
                onClick={() => putBack(undoable)}
                data-track="undo-take"
              >
                Put back
              </Button>
            )}
          </div>
        )}
      </li>
    );
  }

  const tone = weighing && !said ? weighing.verdict : said?.tone;

  return (
    <li ref={row} className="border-b py-3">
      <form onSubmit={submit} aria-label="Add a bite" aria-busy={pending} className="grid gap-4">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,9rem)] gap-2">
          <FieldLabel htmlFor="note" className="sr-only">
            What is it?
          </FieldLabel>
          <Input
            id="note"
            name="note"
            autoComplete="off"
            placeholder="What is it?"
            className="h-11"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <FieldLabel htmlFor="amount" className="sr-only">
            Price ({currencySymbol(currency)})
          </FieldLabel>
          <Input
            ref={amountInput}
            id="amount"
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            required
            autoFocus={!changing}
            placeholder={`Price (${currencySymbol(currency)})`}
            aria-invalid={said?.tone === "error"}
            className="h-11 text-end tabular-nums"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setSaid(null);

              if (event.target.value.trim() === "") setWeighing(null);
            }}
          />
        </div>

        <FieldSet className="gap-2">
          <FieldLegend variant="label" className="sr-only">
            From which slice?
          </FieldLegend>
          <RadioGroup
            name="sliceId"
            value={sliceId}
            onValueChange={setSliceId}
            className="flex flex-wrap gap-2"
          >
            {slices.map((slice) => (
              <FieldLabel
                key={slice.id}
                htmlFor={`slice-${slice.id}`}
                className="h-11 w-auto cursor-pointer gap-2 rounded-full border px-4 whitespace-nowrap has-data-[state=checked]:border-foreground has-data-[state=checked]:bg-secondary"
              >
                <RadioGroupItem id={`slice-${slice.id}`} value={slice.id} />
                {slice.name}
              </FieldLabel>
            ))}
          </RadioGroup>
        </FieldSet>

        <Answer tone={tone}>
          {said?.sentence ??
            (weighing && (
              <>
                <span className="font-medium tabular-nums">
                  {weighing.portion} of {weighing.sliceName}
                </span>
                {" · "}
                {describeVerdict(weighing)}
              </>
            ))}
        </Answer>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <FieldLabel htmlFor="every-month" className="h-11 w-fit cursor-pointer gap-3">
            <Checkbox
              id="every-month"
              checked={everyMonth}
              onCheckedChange={(checked) => {
                setEveryMonth(checked === true);

                if (checked !== true) setReplaces(null);
              }}
              data-track="every-month"
            />
            Every month
          </FieldLabel>
          {replaces && (
            <p className="text-sm text-muted-foreground">
              Takes the place of {replaces.note || "the old one"} from this month.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="lg" disabled={pending} data-track={everyMonth ? "stock" : "take"}>
            {everyMonth ? "Add to every month" : "Take the bite"}
          </Button>
          <Button
            type="button"
            size="lg"
            variant="ghost"
            onClick={close}
            disabled={pending}
            data-track="cancel-bite"
          >
            Cancel
          </Button>
        </div>
      </form>
    </li>
  );
}
