import { bakePie } from "./bake-pie";
import type { Ports } from "./ports";
import { readStatement } from "./read-statement";
import { servePie } from "./serve-pie";
import { takeBite } from "./take-bite";
import { takeBites } from "./take-bites";
import { weighBite } from "./weigh-bite";

export type { BakePieInput } from "./bake-pie";

export type { Advisor, Ports, Rows } from "./ports";

export type { DraftBite, ReadStatementInput, StatementPreview } from "./read-statement";

export type { TakeBiteInput } from "./take-bite";

export type { TakenBites, TakeBitesInput } from "./take-bites";

export type { WeighBiteInput } from "./weigh-bite";

export { mostBites } from "./read-statement";

export { bakePie, readStatement, servePie, takeBite, takeBites, weighBite };

/** Every use case, wired to one set of ports. */
export function pienance(ports: Ports) {
  return {
    bakePie: bakePie(ports),
    servePie: servePie(ports),
    weighBite: weighBite(ports),
    takeBite: takeBite(ports),
    readStatement: readStatement(ports),
    takeBites: takeBites(ports),
  };
}

export type Pienance = ReturnType<typeof pienance>;
