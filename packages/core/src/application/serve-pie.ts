import { Month, type Pie } from "../domain";
import type { Ports } from "./ports";

/** This month's pie, with what was eaten and what is left. */
export function servePie(ports: Ports) {
  return (): Promise<Pie | null> => ports.pies.find(Month.of(ports.now()));
}
