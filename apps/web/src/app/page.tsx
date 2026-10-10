import { ownerOf } from "@pienance/auth";
import { describeLeftover } from "@pienance/core";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BakeForm } from "@/components/bake-form";
import { BiteList } from "@/components/bite-list";
import { Headline } from "@/components/headline";
import { Legend } from "@/components/legend";
import { Masthead } from "@/components/masthead";
import { PageFrame } from "@/components/page-frame";
import { PieDiagram } from "@/components/pie-diagram";
import { PieTools } from "@/components/pie-tools";
import { WeighForm } from "@/components/weigh-form";
import { auth, clock } from "@/pienance";
import { bakePie, readPie, signOut, takeBite, weighBite } from "./actions";

export const dynamic = "force-dynamic";

const monthName = new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" });

const actions = { readPie, bakePie, weighBite, takeBite };

export default async function Home() {
  if (!(await ownerOf(auth(), await headers()))) redirect("/sign-in");

  const pie = await readPie();
  const month = monthName.format(clock());

  return (
    <PageFrame>
      <Masthead month={month} signOut={signOut} />

      <main className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-16">
        {pie ? (
          <>
            <section className="grid content-start gap-6" aria-labelledby="leftover-heading">
              <Headline id="leftover-heading">{describeLeftover(pie.leftoverWords)}</Headline>
              <PieDiagram slices={pie.slices} label={`What is left of each slice in ${month}`} />
              <Legend slices={pie.slices} />
            </section>

            <div className="grid content-start gap-10 lg:gap-16">
              {/* Keyed by bite count so the form starts fresh after a bite is taken. */}
              <WeighForm
                key={pie.bites.length}
                slices={pie.slices}
                currency={pie.currency}
                actions={actions}
              />
              <BiteList bites={pie.bites} />
            </div>
          </>
        ) : (
          <>
            <section className="grid content-start gap-6" aria-labelledby="bake-heading">
              <Headline id="bake-heading">Bake this month&rsquo;s pie.</Headline>
              <p className="max-w-[60ch] text-muted-foreground">
                Tell pienance what comes in each month, in any currency. It cuts it into Needs,
                Wants and Savings, then shows what is left as slices — never as a spreadsheet.
              </p>
            </section>
            <BakeForm defaultCurrency="USD" bakePie={bakePie} />
          </>
        )}
      </main>

      <PieTools pie={pie} actions={actions} />
    </PageFrame>
  );
}
