"use client";

import { describeWeighing, type SliceView } from "@pienance/core";
import { Button } from "@pienance/ui/components/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@pienance/ui/components/field";
import { Input } from "@pienance/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@pienance/ui/components/radio-group";
import { startTransition, useActionState, type FormEvent } from "react";
import { takeBite, weighBite } from "@/app/actions";
import { Answer, type Tone } from "./answer";
import { currencySymbol } from "./currency-symbol";

interface Said {
  readonly tone: Tone;
  readonly sentence: string;
}

async function answer(_previous: Said | null, form: FormData): Promise<Said | null> {
  const bite = {
    sliceId: String(form.get("sliceId") ?? ""),
    amount: String(form.get("amount") ?? ""),
    note: String(form.get("note") ?? ""),
  };

  if (form.get("intent") === "take") {
    const outcome = await takeBite(bite);

    // Silent success: the bite shows up in the list.
    return outcome.ok ? null : { tone: "error", sentence: outcome.error };
  }

  const outcome = await weighBite(bite);

  if (!outcome.ok) return { tone: "error", sentence: outcome.error };

  return { tone: outcome.value.verdict, sentence: describeWeighing(outcome.value) };
}

export function WeighForm({
  slices,
  currency,
}: {
  slices: readonly SliceView[];
  currency: string;
}) {
  const [said, dispatch, pending] = useActionState(answer, null);

  // Dispatched by hand rather than via `action`, so React keeps the fields after weighing.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const { nativeEvent } = event;
    const submitter = nativeEvent instanceof SubmitEvent ? nativeEvent.submitter : null;
    const form = new FormData(event.currentTarget, submitter);

    startTransition(() => dispatch(form));
  }

  return (
    <section className="grid content-start gap-4" aria-labelledby="weigh-heading">
      <h2 id="weigh-heading" className="text-2xl">
        Is it worth it?
      </h2>
      <p className="text-muted-foreground">Weigh a bite before you take it.</p>

      <form onSubmit={submit} aria-busy={pending}>
        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel htmlFor="note">What is it?</FieldLabel>
            <Input
              id="note"
              name="note"
              autoComplete="off"
              placeholder="New running shoes"
              className="h-12"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="amount">Price ({currencySymbol(currency)})</FieldLabel>
            <Input
              id="amount"
              name="amount"
              inputMode="decimal"
              autoComplete="off"
              required
              aria-invalid={said?.tone === "error"}
              className="h-12"
            />
          </Field>

          <FieldSet className="gap-3">
            <FieldLegend variant="label">From which slice?</FieldLegend>
            <RadioGroup
              name="sliceId"
              defaultValue={slices[0]?.id ?? ""}
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

          <div className="flex flex-wrap items-center gap-2">
            <Button size="lg" name="intent" value="weigh" disabled={pending}>
              Weigh it
            </Button>
            <Button size="lg" variant="outline" name="intent" value="take" disabled={pending}>
              Take the bite
            </Button>
          </div>

          <Answer tone={pending ? undefined : said?.tone}>
            {pending ? "Weighing…" : said?.sentence}
          </Answer>
        </FieldGroup>
      </form>
    </section>
  );
}
