import { Money, Month, Pie, PieError, Proportion, type Serving, type Slice } from "../domain";
import type { Ports } from "./ports";

/** Shares are picked in steps of this many percent. */
export const shareStep = 5;

export interface ResliceInput {
  readonly ownerId: string;
  /** As typed, in the pie's currency; leave it out to keep the income. */
  readonly monthlyIncome?: string | undefined;
  /** Every live slice, in order. A known slice left out is retired; one without an id is new. */
  readonly slices: readonly {
    readonly id?: string | undefined;
    readonly name: string;
    /** A whole number of steps of 5. */
    readonly percent: number;
  }[];
}

/** Changes the income or the slices of the pie in place, keeping every bite. */
export function reslicePie(ports: Ports) {
  return async (input: ResliceInput): Promise<Pie> => {
    const pie = await proposal(ports, input);

    await ports.pies.save(pie);

    return pie;
  };
}

/** How this month's bites would sit in the re-sliced pie, without saving it. */
export function previewReslice(ports: Ports) {
  return async (input: ResliceInput): Promise<Serving[]> =>
    (await proposal(ports, input)).servings();
}

async function proposal(ports: Ports, input: ResliceInput): Promise<Pie> {
  const pie = await ports.pies.find(input.ownerId, Month.of(ports.now()));

  if (!pie) throw new PieError("Bake a pie first");

  const live = input.slices.map((slice): Slice => {
    if (slice.id !== undefined) pie.slice(slice.id);

    if (!Number.isInteger(slice.percent / shareStep) || slice.percent < 0) {
      throw new PieError(`Shares go in steps of ${shareStep}%.`);
    }

    return {
      id: slice.id ?? ports.newId(),
      name: slice.name.trim(),
      share: Proportion.of(slice.percent / 100),
    };
  });

  const kept = new Set(live.map((slice) => slice.id));

  const retired = pie.slices
    .filter((slice) => !kept.has(slice.id))
    .map((slice): Slice => ({ ...slice, share: Proportion.none, retired: true }));

  return pie.reslice({
    ...(input.monthlyIncome !== undefined && {
      income: Money.parse(input.monthlyIncome, pie.currency),
    }),
    slices: [...live, ...retired],
  });
}
