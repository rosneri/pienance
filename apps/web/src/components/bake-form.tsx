"use client";

import { useActionState } from "react";
import { bakePie } from "@/app/actions";

async function bake(_previous: string | null, form: FormData): Promise<string | null> {
  const outcome = await bakePie({ monthlyIncome: Number(form.get("monthlyIncome")) });

  return outcome.ok ? null : outcome.error;
}

export function BakeForm() {
  const [error, dispatch, pending] = useActionState(bake, null);

  return (
    <form className="panel" action={dispatch} aria-busy={pending}>
      <label className="field">
        <span className="field__label">What comes in each month?</span>
        <input
          className="input"
          name="monthlyIncome"
          type="number"
          inputMode="decimal"
          min="1"
          step="0.01"
          required
          aria-invalid={error !== null}
        />
      </label>
      <div className="actions">
        <button className="button" disabled={pending}>
          {pending ? "Baking…" : "Bake my pie"}
        </button>
      </div>
      <p className="verdict" role="status" data-verdict={error ? "error" : undefined}>
        {error}
      </p>
    </form>
  );
}
