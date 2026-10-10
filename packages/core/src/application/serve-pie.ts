import { Month, type Pie } from "../domain";
import type { Ports } from "./ports";

/** The owner's pie this month, with what was eaten and what is left. */
export function servePie(ports: Ports) {
  return (ownerId: string): Promise<Pie | null> => ports.pies.find(ownerId, Month.of(ports.now()));
}
