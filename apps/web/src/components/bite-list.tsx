import type { BiteView } from "@pienance/core";
import Link from "next/link";

export function BiteList({
  bites,
  heading = "Eaten this month",
  empty = "Not a crumb yet.",
  importable = false,
}: {
  bites: readonly BiteView[];
  heading?: string;
  empty?: string;
  /** Links to importing a bank statement, for this month's bites. */
  importable?: boolean;
}) {
  return (
    <section className="grid content-start gap-4" aria-labelledby="bites-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="bites-heading" className="text-2xl">
          {heading}
        </h2>
        {importable && (
          <Link
            href="/import"
            className="text-sm whitespace-nowrap underline decoration-berry underline-offset-4"
          >
            Bring in a statement
          </Link>
        )}
      </div>
      {bites.length === 0 ? (
        <p className="max-w-[60ch] text-muted-foreground">{empty}</p>
      ) : (
        <ul className="grid">
          {bites.map((bite) => (
            <li key={bite.id} className="flex justify-between gap-4 border-b py-3">
              <span>{bite.note || "Something"}</span>
              <span className="text-end text-muted-foreground">
                {bite.portionWords} of {bite.sliceName}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
