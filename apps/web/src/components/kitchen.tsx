"use client";

import { describeSwept, type PieView, type StapleView } from "@pienance/core";
import { useState } from "react";
import type { PieActions } from "@/server/pie-actions";
import { BiteComposer } from "./bite-composer";
import { BiteList } from "./bite-list";
import { ResetPie } from "./reset-pie";
import { StapleList } from "./staple-list";

const discovery =
  "Not a crumb yet. Rent or subscriptions? Add them with “Every month” ticked and they count from the 1st.";

/**
 * This month's working column: the pantry, then the bites, with a row to weigh and add one,
 * then a way to start over.
 */
export function Kitchen({
  pie,
  actions,
}: {
  pie: PieView;
  actions: Pick<
    PieActions,
    | "weighBite"
    | "takeBite"
    | "putBackBite"
    | "putBackSpread"
    | "moveBite"
    | "stockStaple"
    | "dropStaple"
    | "resetPie"
  >;
}) {
  const [changing, setChanging] = useState<StapleView | null>(null);
  // Nothing more is eaten from a retired slice.
  const live = pie.slices.filter((slice) => !slice.retired);

  return (
    <div className="grid content-start gap-10 lg:gap-16">
      <StapleList
        staples={pie.staples}
        monthName={pie.monthName}
        actions={actions}
        onChange={setChanging}
      />
      <BiteList
        bites={pie.bites}
        empty={discovery}
        importable
        swept={describeSwept(pie)}
        slices={live}
        actions={actions}
        composer={
          <BiteComposer
            slices={live}
            currency={pie.currency}
            actions={actions}
            changing={changing}
          />
        }
      />
      <ResetPie actions={actions} />
    </div>
  );
}
