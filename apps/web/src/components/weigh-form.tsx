"use client";

import { describeWeighing, type SliceView, type Verdict } from "@pienance/core";
import { startTransition, useActionState, type FormEvent } from "react";
import { takeBite, weighBite } from "@/app/actions";

interface Answer {
  readonly tone: Verdict | "error";
  readonly sentence: string;
}

async function answer(_previous: Answer | null, form: FormData): Promise<Answer | null> {
  const bite = {
    sliceId: String(form.get("sliceId") ?? ""),
    amount: Number(form.get("amount")),
    note: String(form.get("note") ?? ""),
  };

  if (form.get("intent") === "take") {
    const outcome = await takeBite(bite);

    // Silent success: the bite shows up in the list below.
    return outcome.ok ? null : { tone: "error", sentence: outcome.error };
  }

  const outcome = await weighBite(bite);

  if (!outcome.ok) return { tone: "error", sentence: outcome.error };

  return { tone: outcome.value.verdict, sentence: describeWeighing(outcome.value) };
}

export function WeighForm({ slices }: { slices: readonly SliceView[] }) {
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
    <section className="panel" aria-labelledby="weigh-heading">
      <h2 id="weigh-heading">Is it worth it?</h2>
      <p className="panel__lead">Weigh a bite before you take it.</p>

      <form className="panel" onSubmit={submit} aria-busy={pending}>
        <label className="field">
          <span className="field__label">What is it?</span>
          <input className="input" name="note" autoComplete="off" placeholder="New running shoes" />
        </label>

        <label className="field">
          <span className="field__label">Price</span>
          <input
            className="input"
            name="amount"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            required
            aria-invalid={said?.tone === "error"}
          />
        </label>

        <fieldset className="choices">
          <legend>From which slice?</legend>
          {slices.map((slice, index) => (
            <label key={slice.id} className="chip">
              <input type="radio" name="sliceId" value={slice.id} defaultChecked={index === 0} />
              {slice.name}
            </label>
          ))}
        </fieldset>

        <div className="actions">
          <button className="button" name="intent" value="weigh" disabled={pending}>
            Weigh it
          </button>
          <button className="button button--quiet" name="intent" value="take" disabled={pending}>
            Take the bite
          </button>
        </div>

        <p className="verdict" role="status" data-verdict={said?.tone}>
          {pending ? "Weighing…" : said?.sentence}
        </p>
      </form>
    </section>
  );
}
