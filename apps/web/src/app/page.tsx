import { describeLeftover } from "@pienance/core";
import { BakeForm } from "@/components/bake-form";
import { BiteList } from "@/components/bite-list";
import { Legend } from "@/components/legend";
import { PieDiagram } from "@/components/pie-diagram";
import { PieTools } from "@/components/pie-tools";
import { WeighForm } from "@/components/weigh-form";
import { clock } from "@/pienance";
import { readPie } from "./actions";

export const dynamic = "force-dynamic";

const monthName = new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" });

export default async function Home() {
  const pie = await readPie();
  const month = monthName.format(clock());

  return (
    <div className="page">
      <header className="masthead">
        <span className="wordmark">pienance</span>
        <span className="masthead__month">{month}</span>
      </header>

      {pie ? (
        <main className="table">
          <section className="map" aria-labelledby="leftover-heading">
            <h1 id="leftover-heading">{describeLeftover(pie.leftoverWords)}</h1>
            <PieDiagram slices={pie.slices} label={`What is left of each slice in ${month}`} />
            <Legend slices={pie.slices} />
          </section>

          <div className="panels">
            {/* Keyed by bite count so the form starts fresh after a bite is taken. */}
            <WeighForm key={pie.bites.length} slices={pie.slices} />
            <BiteList bites={pie.bites} />
          </div>
        </main>
      ) : (
        <main className="table">
          <section className="map" aria-labelledby="bake-heading">
            <h1 id="bake-heading">Bake this month&rsquo;s pie.</h1>
            <p className="panel__lead">
              Tell pienance what comes in each month. It cuts it into Needs, Wants and Savings, then
              shows what is left as slices — never as a spreadsheet.
            </p>
          </section>
          <BakeForm />
        </main>
      )}

      <footer className="colophon">pienance — proportions, not numbers.</footer>
      <PieTools slices={pie?.slices ?? null} />
    </div>
  );
}
