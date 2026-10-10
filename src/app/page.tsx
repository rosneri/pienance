import { roughly } from "@/domain";
import { pienance } from "@/infrastructure/container";
import { BakeForm } from "./bake-form";
import { PieChart } from "./pie-chart";
import { WeighForm } from "./weigh-form";

export const dynamic = "force-dynamic";

export default async function Home() {
  const pie = await pienance.servePie();

  if (!pie) {
    return (
      <>
        <h1>pienance</h1>
        <BakeForm />
      </>
    );
  }

  const servings = pie.servings();

  return (
    <>
      <h1>pienance</h1>
      <p className="lead">You have {roughly(pie.leftover())} of your pie left this month.</p>
      <PieChart servings={servings} />

      <ul className="card servings">
        {servings.map(({ slice, left }) => (
          <li key={slice.id}>
            <strong>{slice.name}</strong> <span>{roughly(left)} left</span>
          </li>
        ))}
      </ul>

      {/* Keyed by bite count so the form starts fresh after a bite is taken. */}
      <WeighForm key={pie.bites.length} slices={pie.slices.map(({ id, name }) => ({ id, name }))} />

      <section className="card">
        <h2>Bites this month</h2>
        {pie.bites.length === 0 ? (
          <p>Nothing eaten yet.</p>
        ) : (
          <ul className="bites">
            {pie.bites.toReversed().map((bite) => (
              <li key={bite.id}>
                <span>{bite.note || "Something"}</span>{" "}
                <span>
                  {roughly(pie.portionOf(bite))} of {pie.slice(bite.sliceId).name}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
