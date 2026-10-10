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
    <div className="mx-auto grid max-w-6xl gap-10 pt-4 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(2.5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] lg:gap-16 lg:pt-6">
      <header className="flex items-baseline justify-between gap-4">
        <span className="font-display text-xl font-[650] tracking-tight [font-variation-settings:'SOFT'_100] after:ml-1 after:inline-block after:size-[0.35em] after:rounded-full after:bg-berry after:content-['']">
          pienance
        </span>
        <span className="text-sm text-muted-foreground">{month}</span>
      </header>

      <main className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-16">
        {pie ? (
          <>
            <section className="grid content-start gap-6" aria-labelledby="leftover-heading">
              <h1
                id="leftover-heading"
                className="max-w-[14ch] text-[clamp(2.25rem,4vw+1.25rem,4rem)] leading-[1.08]"
              >
                {describeLeftover(pie.leftoverWords)}
              </h1>
              <PieDiagram slices={pie.slices} label={`What is left of each slice in ${month}`} />
              <Legend slices={pie.slices} />
            </section>

            <div className="grid content-start gap-10 lg:gap-16">
              {/* Keyed by bite count so the form starts fresh after a bite is taken. */}
              <WeighForm key={pie.bites.length} slices={pie.slices} currency={pie.currency} />
              <BiteList bites={pie.bites} />
            </div>
          </>
        ) : (
          <>
            <section className="grid content-start gap-6" aria-labelledby="bake-heading">
              <h1
                id="bake-heading"
                className="max-w-[14ch] text-[clamp(2.25rem,4vw+1.25rem,4rem)] leading-[1.08]"
              >
                Bake this month&rsquo;s pie.
              </h1>
              <p className="max-w-[60ch] text-muted-foreground">
                Tell pienance what comes in each month, in any currency. It cuts it into Needs,
                Wants and Savings, then shows what is left as slices — never as a spreadsheet.
              </p>
            </section>
            <BakeForm defaultCurrency="USD" />
          </>
        )}
      </main>

      <footer className="border-t pt-4 text-sm text-muted-foreground">
        pienance — proportions, not numbers.
      </footer>
      <PieTools pie={pie} />
    </div>
  );
}
