import {
  isActiveIn,
  type Bite,
  type Carry,
  type Money,
  type Month,
  Pie,
  type PieRepository,
  type Slice,
  type Staple,
  type Sweep,
} from "../domain";

/** What is kept of a pie: every month's bites and staples, not just one month's. */
interface Stored {
  readonly id: string;
  readonly income: Money;
  readonly slices: readonly Slice[];
  readonly bakedAt: Date;
  readonly bites: readonly Bite[];
  readonly staples: readonly Staple[];
  /** Each month's carry, by month ("2026-10"). */
  readonly carries: ReadonlyMap<string, Carry>;
  readonly sweep: Sweep | undefined;
}

/** For tests and running the app without a database. Keeps one pie per owner. */
export class InMemoryPieRepository implements PieRepository {
  private readonly pies = new Map<string, Stored>();

  async find(ownerId: string, month: Month): Promise<Pie | null> {
    const stored = this.pies.get(ownerId);

    if (!stored) return null;

    return Pie.bake({
      id: stored.id,
      ownerId,
      income: stored.income,
      slices: stored.slices,
      bakedAt: stored.bakedAt,
      month,
      bites: stored.bites.filter((bite) => month.contains(bite.eatenAt)),
      staples: stored.staples.filter((staple) => isActiveIn(staple, month)),
      carry: stored.carries.get(month.toString()),
      sweep: stored.sweep,
    });
  }

  async save(pie: Pie): Promise<void> {
    const stored = this.pies.get(pie.ownerId);
    const same = stored?.id === pie.id;
    const bites = [...pie.bites, ...pie.laterBites];
    const biteIds = new Set([...bites.map((bite) => bite.id), ...pie.putBackIds()]);
    const putBackSpreads = new Set(pie.putBackSpreadIds());
    const stapleIds = new Set(pie.staples.map((staple) => staple.id));
    const carries = new Map(same ? stored.carries : []);

    if (pie.carry) carries.set(pie.month.toString(), pie.carry);
    else if (pie.carryDropped()) carries.delete(pie.month.toString());

    // A spread put back goes from the served month on; its earlier parts stay.
    const kept = (bite: Bite) =>
      !biteIds.has(bite.id) &&
      !(bite.spread && putBackSpreads.has(bite.spread.id) && bite.eatenAt >= pie.month.start);

    this.pies.set(pie.ownerId, {
      id: pie.id,
      income: pie.income,
      slices: pie.slices,
      bakedAt: pie.bakedAt,
      bites: [...(same ? stored.bites : []).filter(kept), ...bites],
      staples: [
        ...(same ? stored.staples : []).filter((staple) => !stapleIds.has(staple.id)),
        ...pie.staples,
      ],
      carries,
      sweep: pie.sweep,
    });
  }
}
