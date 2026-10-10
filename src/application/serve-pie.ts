import { Month, type Pie, type PieRepository } from "@/domain";

/** The pie of the given month, with what was eaten and what is left. */
export function servePie(pies: PieRepository) {
  return (month: Month = Month.current()): Promise<Pie | null> => pies.find(month);
}
