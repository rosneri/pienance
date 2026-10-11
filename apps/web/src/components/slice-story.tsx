"use client";

import { describeSlice, type PieView } from "@pienance/core";
import { Button } from "@pienance/ui/components/button";
import { useSliceFocus } from "./slice-focus";

/** Under the pie: the focused slice told in a sentence, or how to read the pie. */
export function SliceStory({ pie }: { pie: PieView }) {
  const { focused, toggle } = useSliceFocus();
  const slice = focused && pie.slices.find((candidate) => candidate.id === focused.id);

  return (
    <div className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2" role="status">
      {slice ? (
        <Told sentence={describeSlice(slice, pie)} clear={() => toggle?.(null)} />
      ) : (
        <Hint pie={pie} />
      )}
    </div>
  );
}

function Hint({ pie }: { pie: PieView }) {
  return (
    <p className="max-w-[60ch] text-sm text-muted-foreground">
      {pie.gone === undefined
        ? "Tap a slice to see only its bites."
        : "The hatching shows how much of each slice the month has used so far. Tap a slice to see its pace and its bites."}
    </p>
  );
}

function Told({ sentence, clear }: { sentence: string; clear: () => void }) {
  return (
    <>
      <p className="max-w-[60ch]">{sentence}</p>
      <Button variant="outline" className="h-11" onClick={clear} data-track="show-all-slices">
        Show all
      </Button>
    </>
  );
}
