import { Month, type Pie } from "../domain";
import type { Ports } from "./ports";

/** The owner's pie in a month (this one by default), with what was eaten and what is left. */
export function servePie(ports: Ports) {
  return (ownerId: string, month: Month = Month.of(ports.now())): Promise<Pie | null> =>
    ports.pies.find(ownerId, month);
}
