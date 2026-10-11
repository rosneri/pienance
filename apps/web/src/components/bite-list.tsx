"use client";

import type { BiteView } from "@pienance/core";
import type { ReactNode } from "react";
import { useFocus } from "./focus";

export function BiteList({
  bites,
  heading = "Eaten this month",
  empty = "Not a crumb yet.",
  composer,
}: {
  bites: readonly BiteView[];
  heading?: string;
  empty?: string;
  /** The first row, for adding a bite; absent on a month that is over. */
  composer?: ReactNode;
}) {
  const { focused } = useFocus();
  const shown = focused ? bites.filter((bite) => focused.biteIds.includes(bite.id)) : bites;

  // A view across slices without bites (every month) has nothing to list here.
  if (!composer && focused?.kind === "recurrence" && shown.length === 0) return null;

  return (
    <section className="grid content-start gap-4" aria-labelledby="bites-heading">
      <h2 id="bites-heading" className="text-2xl">
        {heading}
        {focused && <span className="text-muted-foreground"> · {focused.name}</span>}
      </h2>
      <ul className="grid">
        {composer}
        {shown.map((bite) => (
          <li key={bite.id} className="flex justify-between gap-4 border-b py-3">
            <span>{bite.note || "Something"}</span>
            <span className="text-end text-muted-foreground tabular-nums">
              {bite.portion} of {bite.sliceName}
            </span>
          </li>
        ))}
      </ul>
      {shown.length === 0 && (
        <p className="max-w-[60ch] text-muted-foreground">
          {focused && bites.length > 0 ? `Nothing here for ${focused.name}.` : empty}
        </p>
      )}
    </section>
  );
}
