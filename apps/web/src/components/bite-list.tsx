"use client";

import type { BiteView } from "@pienance/core";
import { useSliceFocus } from "./slice-focus";

export function BiteList({
  bites,
  heading = "Eaten this month",
  empty = "Not a crumb yet.",
}: {
  bites: readonly BiteView[];
  heading?: string;
  empty?: string;
}) {
  const { focused } = useSliceFocus();
  const shown = focused ? bites.filter((bite) => bite.sliceId === focused.id) : bites;

  return (
    <section className="grid content-start gap-4" aria-labelledby="bites-heading">
      <h2 id="bites-heading" className="text-2xl">
        {heading}
        {focused && <span className="text-muted-foreground"> · {focused.name}</span>}
      </h2>
      {shown.length === 0 ? (
        <p className="max-w-[60ch] text-muted-foreground">
          {focused && bites.length > 0 ? `Nothing eaten from ${focused.name}.` : empty}
        </p>
      ) : (
        <ul className="grid">
          {shown.map((bite) => (
            <li key={bite.id} className="flex justify-between gap-4 border-b py-3">
              <span>{bite.note || "Something"}</span>
              <span className="text-end text-muted-foreground">
                {bite.portion} of {bite.sliceName}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
