import type { Month } from "./month";
import type { Pie } from "./pie";

/** Port: how pies are kept. Implemented in the infrastructure layer. */
export interface PieRepository {
  /** The owner's pie with only the bites eaten during `month`, or null if none was baked yet. */
  find(ownerId: string, month: Month): Promise<Pie | null>;
  save(pie: Pie): Promise<void>;
}
