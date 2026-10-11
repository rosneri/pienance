"use client";

import { describeStaple, describeWeighing, type SliceView, type StapleView } from "@pienance/core";
import { Button } from "@pienance/ui/components/button";
import { Checkbox } from "@pienance/ui/components/checkbox";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@pienance/ui/components/field";
import { Input } from "@pienance/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@pienance/ui/components/radio-group";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { PieActions } from "@/server/pie-actions";
import { Answer, type Tone } from "./answer";
import { currencySymbol } from "./currency-symbol";

interface Said {
  readonly tone: Tone;
  readonly sentence: string;
}

export type WeighActions = Pick<PieActions, "weighBite" | "takeBite" | "stockStaple">;

export function WeighForm({
  slices,
  currency,
  actions,
  changing,
}: {
  slices: readonly SliceView[];
  currency: string;
  actions: WeighActions;
  /** A staple whose amount is being changed: the form takes over its note, slice and amount. */
  changing?: StapleView | null;
}) {
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [sliceId, setSliceId] = useState(slices[0]?.id ?? "");
  const [everyMonth, setEveryMonth] = useState(false);
  const [replaces, setReplaces] = useState<StapleView | null>(null);
  const [taken, setTaken] = useState(changing);
  const form = useRef<HTMLFormElement>(null);
  const amountInput = useRef<HTMLInputElement>(null);

  // A new staple to change fills the form in, once.
  if (changing !== taken) {
    setTaken(changing);

    if (changing) {
      setNote(changing.note);
      setAmount(changing.amount);
      setSliceId(changing.sliceId);
      setEveryMonth(true);
      setReplaces(changing);
    }
  }

  useEffect(() => {
    if (!changing) return;

    form.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    amountInput.current?.focus({ preventScroll: true });
  }, [changing]);

  async function answer(data: FormData): Promise<Said | null> {
    const bite = { sliceId, amount, note };
    const intent = data.get("intent");

    if (intent === "stock") {
      const outcome = await actions.stockStaple({
        ...bite,
        ...(replaces && { replaces: replaces.id }),
      });

      if (!outcome.ok) return { tone: "error", sentence: outcome.error };

      setNote("");
      setAmount("");
      setEveryMonth(false);
      setReplaces(null);

      return { tone: "fits", sentence: describeStaple(outcome.value) };
    }

    if (intent === "take") {
      const outcome = await actions.takeBite(bite);

      // Silent success: the bite shows up in the list.
      return outcome.ok ? null : { tone: "error", sentence: outcome.error };
    }

    const outcome = await actions.weighBite(bite);

    if (!outcome.ok) return { tone: "error", sentence: outcome.error };

    return { tone: outcome.value.verdict, sentence: describeWeighing(outcome.value) };
  }

  const [said, dispatch, pending] = useActionState(
    (_previous: Said | null, data: FormData) => answer(data),
    null,
  );

  // Dispatched by hand rather than via `action`, so React keeps the fields after weighing.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const { nativeEvent } = event;
    const submitter = nativeEvent instanceof SubmitEvent ? nativeEvent.submitter : null;
    const data = new FormData(event.currentTarget, submitter);

    startTransition(() => dispatch(data));
  }

  return (
    <section className="grid content-start gap-4" aria-labelledby="weigh-heading">
      <h2 id="weigh-heading" className="text-2xl">
        Is it worth it?
      </h2>
      <p className="text-muted-foreground">Weigh a bite before you take it.</p>

      <form ref={form} onSubmit={submit} aria-busy={pending} className="scroll-mt-6">
        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel htmlFor="note">What is it?</FieldLabel>
            <Input
              id="note"
              name="note"
              autoComplete="off"
              placeholder="New running shoes"
              className="h-12"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="amount">Price ({currencySymbol(currency)})</FieldLabel>
            <Input
              ref={amountInput}
              id="amount"
              name="amount"
              inputMode="decimal"
              autoComplete="off"
              required
              aria-invalid={said?.tone === "error"}
              className="h-12"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>

          <FieldSet className="gap-3">
            <FieldLegend variant="label">From which slice?</FieldLegend>
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
            <p className="-mt-3 text-sm text-muted-foreground">
              From this month on, it takes the place of {replaces.note || "the old one"}.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button size="lg" name="intent" value="weigh" disabled={pending} data-track="weigh">
              Weigh it
            </Button>
            {everyMonth ? (
              <Button
                size="lg"
                variant="outline"
                name="intent"
                value="stock"
                disabled={pending}
                data-track="stock"
              >
                Add to every month
              </Button>
            ) : (
              <Button
                size="lg"
                variant="outline"
                name="intent"
                value="take"
                disabled={pending}
                data-track="take"
              >
                Take the bite
              </Button>
            )}
          </div>

          <Answer tone={pending ? undefined : said?.tone}>
            {pending ? "Weighing…" : said?.sentence}
          </Answer>
        </FieldGroup>
      </form>
    </section>
  );
}
