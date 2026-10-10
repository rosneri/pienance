import { type Month, Pie, type PieRepository } from "../domain";

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
      bites: pie.bites.filter((bite) => month.contains(bite.eatenAt)),
    });
  }

  async save(pie: Pie): Promise<void> {
    const stored = this.pies.get(pie.ownerId);
    const known = stored?.id === pie.id ? stored.bites : [];
    const ids = new Set(pie.bites.map((bite) => bite.id));

    this.pies.set(
      pie.ownerId,
      Pie.bake({
        id: pie.id,
        ownerId: pie.ownerId,
        income: pie.income,
        slices: pie.slices,
        bites: [...known.filter((bite) => !ids.has(bite.id)), ...pie.bites],
      }),
    );
  }
}
