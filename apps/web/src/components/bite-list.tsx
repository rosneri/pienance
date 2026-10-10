import type { BiteView } from "@pienance/core";

export function BiteList({ bites }: { bites: readonly BiteView[] }) {
  return (
    <section className="grid content-start gap-4" aria-labelledby="bites-heading">
      <h2 id="bites-heading" className="text-2xl">
        Eaten this month
      </h2>
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
