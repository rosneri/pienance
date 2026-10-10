import { type Month, Pie, type PieRepository } from "../domain";

/** For tests and running the app without a database. */
export class InMemoryPieRepository implements PieRepository {
  private pie: Pie | null = null;

  async find(month: Month): Promise<Pie | null> {
    if (!this.pie) return null;

    return Pie.bake({
      id: this.pie.id,
      income: this.pie.income,
      slices: this.pie.slices,
      bites: this.pie.bites.filter((bite) => month.contains(bite.eatenAt)),
    });
  }

  async save(pie: Pie): Promise<void> {
    const known = this.pie?.id === pie.id ? this.pie.bites : [];
    const ids = new Set(pie.bites.map((bite) => bite.id));
    this.pie = Pie.bake({
      id: pie.id,
      income: pie.income,
      slices: pie.slices,
      bites: [...known.filter((bite) => !ids.has(bite.id)), ...pie.bites],
    });
  }
}
