"use client";

import { describeLeftover, describeWeighing, type PieView } from "@pienance/core";
import { useEffect } from "react";
import type { PieActions } from "@/server/pie-actions";

/**
 * WebMCP: exposes pienance to in-browser AI agents as tools
 * (https://github.com/webmachinelearning/webmcp). Tools match the page state:
 * "bake_pie" before there is a pie, reading and weighing tools after.
 * Every tool goes through the same server actions as the UI, so the page stays in sync.
 */
export function PieTools({ pie, actions }: { pie: PieView | null; actions: PieActions }) {
  useEffect(() => {
    const modelContext = document.modelContext;

    if (!modelContext) return;

    const controller = new AbortController();
    const options = { signal: controller.signal };

    if (!pie) {
      void modelContext.registerTool(
        {
          name: "bake_pie",
          title: "Bake this month's pie",
          description:
            "Creates the user's monthly pie from their monthly income, in any currency. It is cut into Needs (half), Wants (about a third) and Savings (a fifth).",
          inputSchema: {
            type: "object",
            properties: {
              monthlyIncome: { type: "number", description: "Money that comes in each month." },
              currency: { type: "string", description: "ISO 4217 code of that money, e.g. EUR." },
            },
            required: ["monthlyIncome", "currency"],
          } as const,
          async execute(input) {
            const outcome = await actions.bakePie({
              monthlyIncome: String(input.monthlyIncome),
              currency: input.currency,
            });

            return outcome.ok ? describeLeftover(outcome.value.leftoverWords) : outcome.error;
          },
        },
        options,
      );

      return () => controller.abort();
    }

    const { slices } = pie;
    const sliceIdOf = (name: string) => slices.find((slice) => slice.name === name)?.id ?? "";

    const biteProperties = {
      amount: { type: "number", description: `Price of the expense, in ${pie.currency}.` },
      slice: {
        type: "string",
        enum: slices.map((slice) => slice.name),
        description: "The slice the expense eats from.",
      },
    } as const;

    void modelContext.registerTool(
      {
        name: "read_pie",
        title: "Read this month's pie",
        description:
          "Returns how much of the user's monthly pie is left, per slice, and what was eaten this month. Everything is described in rough proportions.",
        annotations: { readOnlyHint: true },
        async execute() {
          const current = await actions.readPie();

          if (!current) return "There is no pie yet.";

          return {
            summary: describeLeftover(current.leftoverWords),
            currency: current.currency,
            slices: current.slices.map((slice) => `${slice.name}: ${slice.leftWords} left`),
            bites: current.bites.map(
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
          const outcome = await actions.weighBite({
            sliceId: sliceIdOf(input.slice),
            amount: String(input.amount),
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
          const outcome = await actions.takeBite({
            sliceId: sliceIdOf(input.slice),
            amount: String(input.amount),
            note: input.note,
          });

          return outcome.ok ? `Recorded ${input.note} in ${input.slice}.` : outcome.error;
        },
      },
      options,
    );

    return () => controller.abort();
  }, [pie, actions]);

  return null;
}
