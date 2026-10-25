import { ownerOf } from "@pienance/auth";
import {
  describeLeftover,
  describePace,
  describePastLeftover,
  Month,
  monthName,
} from "@pienance/core";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Appetite } from "@/components/appetite";
import { BakeForm } from "@/components/bake-form";
import { BiteList } from "@/components/bite-list";
import { CarryNote, CarryOffer } from "@/components/carry-offer";
import { Headline } from "@/components/headline";
import { Kitchen } from "@/components/kitchen";
import { Legend } from "@/components/legend";
import { Masthead } from "@/components/masthead";
import { MonthNav } from "@/components/month-nav";
import { PageFrame } from "@/components/page-frame";
import { PieDiagram } from "@/components/pie-diagram";
import { PieTools } from "@/components/pie-tools";
import { Shelf } from "@/components/shelf";
import { FocusProvider } from "@/components/focus";
import { FocusStory } from "@/components/focus-story";
import { StapleList } from "@/components/staple-list";
import { auth, clock } from "@/pienance";
import {
  bakePie,
  carryOver,
  dropCarry,
  dropStaple,
  moveBite,
  previewReslice,
  putBackBite,
  putBackSpread,
  readAppetite,
  readCarryOffer,
  readPie,
  readReslice,
  readShelf,
  readStatement,
  reslicePie,
  resetPie,
  setSweep,
  signOut,
  stockStaple,
  takeBite,
  takeBites,
  weighBite,
} from "./actions";

export const dynamic = "force-dynamic";

const actions = {
  readPie,
  setSweep,
  readCarryOffer,
  carryOver,
  dropCarry,
  readReslice,
  reslicePie,
  previewReslice,
  readShelf,
  readAppetite,
  bakePie,
  weighBite,
  takeBite,
  putBackBite,
  putBackSpread,
  moveBite,
  stockStaple,
  dropStaple,
  readStatement,
  takeBites,
  resetPie,
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  if (!(await ownerOf(auth(), await headers()))) redirect("/sign-in");

  const { month: asked } = await searchParams;
  const pie = await readPie(Array.isArray(asked) ? undefined : asked);
  const thisMonth = monthName(Month.of(clock()));
  // readPie falls back to this month, so any other month served is a past one.
  const past = pie !== null && pie.gone === undefined;

  const [shelf, appetite, carryOffer] = await Promise.all([
    pie ? readShelf(pie.month) : [],
    pie && !past ? readAppetite() : [],
    // Only this month can carry, and only until it did.
    pie && !past && !pie.carry ? readCarryOffer() : null,
  ]);

  const pace = pie && describePace(pie);
  const month = pie?.monthName ?? thisMonth;
  const goneWords = pie?.goneWords ? `, ${pie.goneWords} of the month gone` : "";

  return (
    <PageFrame>
      <Masthead month={month} signOut={signOut} reslice={pie !== null && !past} />

      <main className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-16">
        {pie ? (
          <FocusProvider focuses={pie.focuses}>
            <section
              className="grid min-w-0 content-start gap-6"
              aria-labelledby="leftover-heading"
            >
              <MonthNav months={shelf} month={pie.month} />
              {past && (
                <p className="text-muted-foreground">
                  You are looking at {pie.monthName}.{" "}
                  <Link href="/" className="text-foreground underline underline-offset-4">
                    Back to {thisMonth}.
                  </Link>
                </p>
              )}
              <Headline id="leftover-heading">
                {past
                  ? describePastLeftover(pie.leftoverWords, pie.monthName)
                  : describeLeftover(pie.leftoverWords)}
              </Headline>
              {pace && <p className="-mt-3 max-w-[60ch] text-muted-foreground">{pace}</p>}
              {!past && <CarryOffer offer={carryOffer} slices={pie.slices} actions={actions} />}
              <PieDiagram
                slices={pie.slices}
                label={`What is left of each slice in ${month}${goneWords}`}
                interactive
                {...(pie.gone !== undefined && { gone: pie.gone })}
              />
              <Legend slices={pie.slices} carry={pie.carry} />
              {pie.carry && <CarryNote carry={pie.carry} {...(!past && { actions })} />}
              <FocusStory pie={pie} />
              <Shelf months={shelf} />
              {shelf.length > 0 && !past && <Appetite sentences={appetite} />}
            </section>

            {past ? (
              <div className="grid content-start gap-10 lg:gap-16">
                <StapleList staples={pie.staples} monthName={pie.monthName} />
                <BiteList
                  bites={pie.bites}
                  heading={`Eaten in ${pie.monthName}`}
                  empty="Not a crumb that month."
                />
              </div>
            ) : (
              <Kitchen pie={pie} actions={actions} />
            )}
          </FocusProvider>
        ) : (
          <>
            <section className="grid content-start gap-6" aria-labelledby="bake-heading">
              <Headline id="bake-heading">Bake this month&rsquo;s pie.</Headline>
              <p className="max-w-[60ch] text-muted-foreground">
                Tell pienance what comes in each month, in any currency. It cuts it into Needs,
                Wants and Savings — rename, resize or add your own once it is baked — then shows
                what is left as slices, never as a spreadsheet.
              </p>
            </section>
            <BakeForm defaultCurrency="USD" bakePie={bakePie} />
          </>
        )}
      </main>

      <PieTools pie={pie} past={past} actions={actions} />
    </PageFrame>
  );
}
