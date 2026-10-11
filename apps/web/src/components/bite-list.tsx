import type { BiteView } from "@pienance/core";

export function BiteList({
  bites,
  heading = "Eaten this month",
  empty = "Not a crumb yet.",
}: {
  bites: readonly BiteView[];
  heading?: string;
  empty?: string;
}) {
  return (
    <section className="grid content-start gap-4" aria-labelledby="bites-heading">
      <h2 id="bites-heading" className="text-2xl">
        {heading}
      </h2>
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
