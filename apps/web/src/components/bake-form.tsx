"use client";

import { currencyCodes } from "@pienance/core";
import { Button } from "@pienance/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@pienance/ui/components/field";
import { Input } from "@pienance/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@pienance/ui/components/native-select";
import { useActionState } from "react";
import { bakePie } from "@/app/actions";
import { Answer } from "./answer";

const currencyNames = new Intl.DisplayNames("en", { type: "currency" });

async function bake(_previous: string | null, form: FormData): Promise<string | null> {
  const outcome = await bakePie({
    monthlyIncome: String(form.get("monthlyIncome") ?? ""),
    currency: String(form.get("currency") ?? ""),
  });

  return outcome.ok ? null : outcome.error;
}

export function BakeForm({ defaultCurrency }: { defaultCurrency: string }) {
  const [error, dispatch, pending] = useActionState(bake, null);

  return (
    <form action={dispatch} aria-busy={pending}>
      <FieldGroup className="gap-5">
        <Field>
          <FieldLabel htmlFor="currency">Currency</FieldLabel>
          <NativeSelect
            id="currency"
            name="currency"
            defaultValue={defaultCurrency}
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
            required
            aria-invalid={error !== null}
            className="h-12"
          />
        </Field>

        <div className="flex items-center">
          <Button size="lg" disabled={pending}>
            {pending ? "Baking…" : "Bake my pie"}
          </Button>
        </div>

        <Answer tone={error ? "error" : undefined}>{error}</Answer>
      </FieldGroup>
    </form>
  );
}
