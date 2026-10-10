"use client";

import { describeLeftover, describeWeighing, type SliceView } from "@pienance/core";
import { useEffect } from "react";
import { bakePie, readPie, takeBite, weighBite } from "@/app/actions";

/**
 * WebMCP: exposes pienance to in-browser AI agents as tools
 * (https://github.com/webmachinelearning/webmcp). Tools match the page state:
 * "bake_pie" before there is a pie, reading and weighing tools after.
 * Every tool goes through the same server actions as the UI, so the page stays in sync.
 */
export function PieTools({ slices }: { slices: readonly SliceView[] | null }) {
  useEffect(() => {
    const modelContext = document.modelContext;

    if (!modelContext) return;

    const controller = new AbortController();
    const options = { signal: controller.signal };

    if (!slices) {
      void modelContext.registerTool(
        {
          name: "bake_pie",
          title: "Bake this month's pie",
          description:
            "Creates the user's monthly pie from their monthly income. It is cut into Needs (half), Wants (about a third) and Savings (a fifth).",
          inputSchema: {
            type: "object",
            properties: {
              monthlyIncome: { type: "number", description: "Money that comes in each month." },
            },
            required: ["monthlyIncome"],
          } as const,
          async execute(input) {
            const outcome = await bakePie({ monthlyIncome: input.monthlyIncome });

            return outcome.ok ? describeLeftover(outcome.value.leftoverWords) : outcome.error;
          },
        },
        options,
      );

      return () => controller.abort();
    }

    const sliceNames = slices.map((slice) => slice.name);
    const sliceIdOf = (name: string) => slices.find((slice) => slice.name === name)?.id ?? "";

    const biteProperties = {
      amount: { type: "number", description: "Price of the expense, in the user's currency." },
      slice: { type: "string", enum: sliceNames, description: "The slice the expense eats from." },
    } as const;

    void modelContext.registerTool(
      {
        name: "read_pie",
        title: "Read this month's pie",
        description:
          "Returns how much of the user's monthly pie is left, per slice, and what was eaten this month. Everything is described in rough proportions.",
        annotations: { readOnlyHint: true },
        async execute() {
          const pie = await readPie();

          if (!pie) return "There is no pie yet.";

          return {
            summary: describeLeftover(pie.leftoverWords),
            slices: pie.slices.map((slice) => `${slice.name}: ${slice.leftWords} left`),
            bites: pie.bites.map(
              (bite) => `${bite.note || "Something"}: ${bite.portionWords} of ${bite.sliceName}`,
            ),
          };
        },
      },
      options,
    );

    void modelContext.registerTool(
      {
        name: "weigh_bite",
        title: "Weigh an expense",
        description:
          "Tells whether a prospective expense fits in what is left of a slice this month, without recording it. Use it to answer 'is this worth it?'.",
        annotations: { readOnlyHint: true },
        inputSchema: {
          type: "object",
          properties: biteProperties,
          required: ["amount", "slice"],
        } as const,
        async execute(input) {
          const outcome = await weighBite({
            sliceId: sliceIdOf(input.slice),
            amount: input.amount,
          });

          return outcome.ok ? describeWeighing(outcome.value) : outcome.error;
        },
      },
      options,
    );

    void modelContext.registerTool(
      {
        name: "take_bite",
        title: "Record an expense",
        description: "Records an expense the user made in this month's pie.",
        inputSchema: {
          type: "object",
          properties: {
            ...biteProperties,
            note: { type: "string", description: "What the expense was, in a few words." },
          },
          required: ["amount", "slice", "note"],
        } as const,
        async execute(input) {
          const outcome = await takeBite({
            sliceId: sliceIdOf(input.slice),
            amount: input.amount,
            note: input.note,
          });

          return outcome.ok ? `Recorded ${input.note} in ${input.slice}.` : outcome.error;
        },
      },
      options,
    );

    return () => controller.abort();
  }, [slices]);

  return null;
}
