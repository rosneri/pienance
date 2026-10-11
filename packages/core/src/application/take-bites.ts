import { Money, Month, PieError, type Bite, type Pie } from "../domain";
import type { Ports } from "./ports";
import type { DraftBite } from "./read-statement";

export interface TakeBitesInput {
  readonly ownerId: string;
  readonly bites: readonly DraftBite[];
}

export interface TakenBites {
  readonly taken: number;
  /**
   * Already in the pie: same day, amount and note, as often as the pie has them.
   * Importing a statement twice is harmless; two coffees on one day are still two.
   */
  readonly duplicates: number;
}

const isoDay = /^\d{4}-\d{2}-\d{2}$/;

function dayOf(eatenOn: string): Date {
  const day = new Date(`${eatenOn}T00:00:00Z`);

  if (
    !isoDay.test(eatenOn) ||
    Number.isNaN(day.getTime()) ||
    !day.toISOString().startsWith(eatenOn)
  ) {
    throw new RangeError(`"${eatenOn}" is not a day`);
  }

  return day;
}

function keyOf(bite: Pick<Bite, "eatenAt" | "amount" | "note">): string {
  return `${bite.eatenAt.getTime()}|${bite.amount.minor}|${bite.note}`;
}

function takeNew(pie: Pie, bites: readonly Bite[]): number {
  const known = new Map<string, number>();

  for (const bite of pie.bites) known.set(keyOf(bite), (known.get(keyOf(bite)) ?? 0) + 1);

  let taken = 0;

  for (const bite of bites) {
    const copies = known.get(keyOf(bite)) ?? 0;

    if (copies > 0) {
      known.set(keyOf(bite), copies - 1);
    } else {
      pie.take(bite);
      taken += 1;
    }
  }

  return taken;
}

/** Takes many bites at once, each in the month it was eaten, such as a bank statement's. */
export function takeBites(ports: Ports) {
  return async (input: TakeBitesInput): Promise<TakenBites> => {
    const byMonth = Map.groupBy(
      input.bites.map((draft) => ({ draft, eatenAt: dayOf(draft.eatenOn) })),
      ({ eatenAt }) => Month.of(eatenAt).start.getTime(),
    );

    const months = await Promise.all(
      [...byMonth].map(async ([start, drafts]) => {
        const pie = await ports.pies.find(input.ownerId, Month.of(new Date(start)));

        if (!pie) throw new PieError("Bake a pie first");

        const bites = drafts.map(({ draft, eatenAt }) => ({
          id: ports.newId(),
          sliceId: draft.sliceId,
          amount: Money.parse(draft.amount, pie.currency),
          note: draft.note.trim(),
          eatenAt,
        }));

        return { pie, taken: takeNew(pie, bites) };
      }),
    );

    // Saved only once every bite was taken, so a bad row leaves the pie untouched.
    await Promise.all(months.map(({ pie }) => ports.pies.save(pie)));

    const taken = months.reduce((sum, month) => sum + month.taken, 0);

    return { taken, duplicates: input.bites.length - taken };
  };
}
