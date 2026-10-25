"use client";

import type { PieView, StapleView } from "@pienance/core";
import { useState } from "react";
import type { PieActions } from "@/server/pie-actions";
import { BiteComposer } from "./bite-composer";
import { BiteList } from "./bite-list";
import { ResetPie } from "./reset-pie";
import { SliceEditor } from "./slice-editor";
import { StapleList } from "./staple-list";

const discovery =
  "Not a crumb yet. Rent or subscriptions? Add them with “Every month” ticked and they count from the 1st.";

/**
 * This month's working column: the pantry, then the bites, with a row to weigh and add one,
 * then the slices to make one's own and a way to start over.
 */
export function Kitchen({
  pie,
  actions,
}: {
  pie: PieView;
  actions: Pick<
    PieActions,
    "weighBite" | "takeBite" | "stockStaple" | "dropStaple" | "recutPie" | "resetPie"
  >;
}) {
  const [changing, setChanging] = useState<StapleView | null>(null);

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
        composer={
          <BiteComposer
            slices={pie.slices}
            currency={pie.currency}
            actions={actions}
            changing={changing}
          />
        }
      />
      <SliceEditor slices={pie.slices} actions={actions} />
      <ResetPie actions={actions} />
    </div>
  );
}
