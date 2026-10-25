import { isActiveIn, type Month, Pie, type PieRepository, type Staple } from "../domain";

/** For tests and running the app without a database. Keeps one pie per owner. */
export class InMemoryPieRepository implements PieRepository {
  private readonly pies = new Map<string, Pie>();

  async find(ownerId: string, month: Month): Promise<Pie | null> {
    const pie = this.pies.get(ownerId);

    if (!pie) return null;

    return Pie.bake({
      id: pie.id,
      ownerId,
      income: pie.income,
      slices: pie.slices,
      bakedAt: pie.bakedAt,
      bites: pie.bites.filter((bite) => month.contains(bite.eatenAt)),
      staples: pie.staples.filter((staple) => isActiveIn(staple, month)),
    });
  }

  async save(pie: Pie): Promise<void> {
    const stored = this.pies.get(pie.ownerId);
    const same = stored?.id === pie.id;
    const biteIds = new Set(pie.bites.map((bite) => bite.id));
    const stapleIds = new Set(pie.staples.map((staple) => staple.id));
    const sliceIds = new Set(pie.slices.map((slice) => slice.id));

    const keptBites = (same ? stored.bites : []).filter(
      (bite) => !biteIds.has(bite.id) && sliceIds.has(bite.sliceId),
    );

    const keptStaples: readonly Staple[] = (same ? stored.staples : []).filter(
      (staple) => !stapleIds.has(staple.id) && sliceIds.has(staple.sliceId),
    );

    this.pies.set(
      pie.ownerId,
      Pie.bake({
        id: pie.id,
        ownerId: pie.ownerId,
        income: pie.income,
        slices: pie.slices,
        bakedAt: pie.bakedAt,
        bites: [...keptBites, ...pie.bites],
        staples: [...keptStaples, ...pie.staples],
      }),
    );
  }

  async remove(ownerId: string): Promise<void> {
    this.pies.delete(ownerId);
  }
}
