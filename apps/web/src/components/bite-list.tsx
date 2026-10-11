import type { BiteView } from "@pienance/core";
import Link from "next/link";

export function BiteList({ bites }: { bites: readonly BiteView[] }) {
  return (
    <section className="grid content-start gap-4" aria-labelledby="bites-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="bites-heading" className="text-2xl">
          Eaten this month
        </h2>
        <Link
          href="/import"
          className="text-sm whitespace-nowrap underline decoration-berry underline-offset-4"
        >
          Bring in a statement
        </Link>
      </div>
      {bites.length === 0 ? (
        <p className="text-muted-foreground">Not a crumb yet.</p>
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
