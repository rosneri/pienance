"use client";

import type { PieView, StapleView } from "@pienance/core";
import { useState } from "react";
import type { PieActions } from "@/server/pie-actions";
import { BiteList } from "./bite-list";
import { StapleList } from "./staple-list";
import { WeighForm } from "./weigh-form";

const discovery =
  "Not a crumb yet. Rent or subscriptions? Tick “Every month” and they count from the 1st.";

/** This month's working column: weigh and take bites, keep the pantry, see what was eaten. */
export function Kitchen({
  pie,
  actions,
}: {
  pie: PieView;
  actions: Pick<PieActions, "weighBite" | "takeBite" | "stockStaple" | "dropStaple">;
}) {
  const [changing, setChanging] = useState<StapleView | null>(null);

  return (
    <div className="grid content-start gap-10 lg:gap-16">
      {/* Keyed by bite count so the form starts fresh after a bite is taken. */}
      <WeighForm
        key={pie.bites.length}
        slices={pie.slices}
        currency={pie.currency}
        actions={actions}
        changing={changing}
      />
      <StapleList
        staples={pie.staples}
        monthName={pie.monthName}
        actions={actions}
        onChange={setChanging}
      />
      <BiteList bites={pie.bites} empty={discovery} />
    </div>
  );
}
