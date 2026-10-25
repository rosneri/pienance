import type { Ports } from "./ports";

/** Starts over: removes the owner's pie with every month of bites and staples. */
export function resetPie(ports: Ports) {
  return (ownerId: string): Promise<void> => ports.pies.remove(ownerId);
}
