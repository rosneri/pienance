"use client";

import { currencyCodes } from "@pienance/core";
import { Button } from "@pienance/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@pienance/ui/components/field";
import { Input } from "@pienance/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@pienance/ui/components/native-select";
import { useActionState } from "react";
import type { PieActions } from "@/server/pie-actions";
import { Answer } from "./answer";

const currencyNames = new Intl.DisplayNames("en", { type: "currency" });

/** What a refused attempt hands back: the reason, and what was typed (React resets the form). */
interface Refusal {
  readonly error: string;
  readonly monthlyIncome: string;
  readonly currency: string;
}

async function bake(bakePie: PieActions["bakePie"], form: FormData): Promise<Refusal | null> {
  const input = {
    monthlyIncome: String(form.get("monthlyIncome") ?? ""),
    currency: String(form.get("currency") ?? ""),
  };

  const outcome = await bakePie(input);

  return outcome.ok ? null : { error: outcome.error, ...input };
}

export function BakeForm({
  defaultCurrency,
  bakePie,
}: {
  defaultCurrency: string;
  bakePie: PieActions["bakePie"];
}) {
  const [refusal, dispatch, pending] = useActionState(
    (_previous: Refusal | null, form: FormData) => bake(bakePie, form),
    null,
  );

  return (
    <form action={dispatch} aria-busy={pending}>
      <FieldGroup className="gap-5">
        <Field>
          <FieldLabel htmlFor="currency">Currency</FieldLabel>
          <NativeSelect
            id="currency"
            name="currency"
            defaultValue={refusal?.currency ?? defaultCurrency}
            className="h-12 text-base"
          >
            {currencyCodes.map((code) => (
              <NativeSelectOption key={code} value={code}>
                {code} — {currencyNames.of(code) ?? code}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor="monthlyIncome">What comes in each month?</FieldLabel>
          <Input
            id="monthlyIncome"
            name="monthlyIncome"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={refusal?.monthlyIncome}
            required
            aria-invalid={refusal !== null}
            className="h-12"
          />
        </Field>

        <div className="flex items-center">
          <Button size="lg" disabled={pending}>
            {pending ? "Baking…" : "Bake my pie"}
          </Button>
        </div>

        <Answer tone={refusal ? "error" : undefined}>{refusal?.error}</Answer>
      </FieldGroup>
    </form>
  );
}
