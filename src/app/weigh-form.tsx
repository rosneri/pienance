"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { biteAction, type BiteState } from "./actions";

const verdictWords = {
  fits: "Fits nicely.",
  tight: "It fits, but leaves only crumbs.",
  overflows: "That is more than what is left.",
} as const;

export function WeighForm({ slices }: { slices: readonly { id: string; name: string }[] }) {
  const [state, dispatch, pending] = useActionState(biteAction, {} satisfies BiteState);
  const result = state.weighing;

  // Dispatched by hand rather than via `action` so React keeps the fields after weighing.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { submitter } = event.nativeEvent as SubmitEvent;
    const form = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(form));
  }

  return (
    <form onSubmit={submit} className="card">
      <h2>Is it worth it?</h2>
      <input name="note" placeholder="What is it?" />
      <input name="amount" type="number" min="0.01" step="0.01" required placeholder="Price" />
      <select name="sliceId" required>
        {slices.map((slice) => (
          <option key={slice.id} value={slice.id}>
            {slice.name}
          </option>
        ))}
      </select>
      <div className="row">
        <button type="submit" name="intent" value="weigh" disabled={pending}>
          Weigh it
        </button>
        <button type="submit" name="intent" value="take" disabled={pending} className="secondary">
          Take the bite
        </button>
      </div>
      {state.error && <p className="verdict overflows">{state.error}</p>}
      {result && (
        <p className={`verdict ${result.verdict}`}>
          {verdictWords[result.verdict]} It is {result.ofSlice} of your {result.sliceName} slice (
          {result.ofLeftover} of what is left, {result.ofPie} of the whole pie) and would leave{" "}
          {result.leftAfter} of it.
        </p>
      )}
    </form>
  );
}
