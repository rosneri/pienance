"use client";

import { Button } from "@pienance/ui/components/button";
import { useState, useTransition } from "react";
import type { PieActions } from "@/server/pie-actions";
import { Answer } from "./answer";

/** Starts over, after asking once: the pie goes with every bite, staple and month. */
export function ResetPie({ actions }: { actions: Pick<PieActions, "resetPie"> }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    startTransition(async () => {
      const outcome = await actions.resetPie();

      setError(outcome.ok ? null : outcome.error);
      setConfirming(false);
    });
  }

  return (
    <section className="grid content-start gap-3" aria-labelledby="reset-heading">
      <h2 id="reset-heading" className="text-2xl">
        Start over
      </h2>
      {confirming ? (
        <div className="grid gap-3">
          <p>
            This deletes your pie and everything eaten from it, in every month. It cannot be undone.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="h-11"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Keep my pie
            </Button>
            <Button
              variant="destructive"
              className="h-11"
              disabled={pending}
              onClick={reset}
              data-track="reset-pie"
            >
              {pending ? "Deleting…" : "Delete everything"}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button
            variant="outline"
            className="h-11"
            onClick={() => setConfirming(true)}
            data-track="reset-pie-ask"
          >
            Reset my data
          </Button>
        </div>
      )}
      {error && <Answer tone="error">{error}</Answer>}
    </section>
  );
}
