import type { BiteView } from "@pienance/core";

export function BiteList({ bites }: { bites: readonly BiteView[] }) {
  return (
    <section className="panel" aria-labelledby="bites-heading">
      <h2 id="bites-heading">Eaten this month</h2>
      {bites.length === 0 ? (
        <p className="empty">Not a crumb yet.</p>
      ) : (
        <ul className="bites">
          {bites.map((bite) => (
            <li key={bite.id}>
              <span>{bite.note || "Something"}</span>
              <span>
                {bite.portionWords} of {bite.sliceName}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
