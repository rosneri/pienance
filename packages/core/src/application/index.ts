import { bakePie } from "./bake-pie";
import { dropStaple } from "./drop-staple";
import type { Ports } from "./ports";
import { readAppetite } from "./read-appetite";
import { readStatement } from "./read-statement";
import { recutPie } from "./recut-pie";
import { resetPie } from "./reset-pie";
import { servePie } from "./serve-pie";
import { shelvePie } from "./shelve-pie";
import { stockStaple } from "./stock-staple";
import { takeBite } from "./take-bite";
import { takeBites } from "./take-bites";
import { weighBite } from "./weigh-bite";

export type { BakePieInput } from "./bake-pie";

export type { DropStapleInput } from "./drop-staple";

export type { Advisor, Ports, Rows } from "./ports";

export type { DraftBite, ReadStatementInput, StatementPreview } from "./read-statement";

export type { ReadAppetiteInput, SliceAppetite } from "./read-appetite";

export type { RecutPieInput, SliceCutInput } from "./recut-pie";

export type { Shelved, ShelvePieInput } from "./shelve-pie";

export type { StockStapleInput } from "./stock-staple";

export type { TakeBiteInput } from "./take-bite";

export type { TakenBites, TakeBitesInput } from "./take-bites";

export type { WeighBiteInput } from "./weigh-bite";

export { mostBites } from "./read-statement";

export {
  bakePie,
  dropStaple,
  readAppetite,
  readStatement,
  recutPie,
  resetPie,
  servePie,
  shelvePie,
  stockStaple,
  takeBite,
  takeBites,
  weighBite,
};

/** Every use case, wired to one set of ports. */
export function pienance(ports: Ports) {
  return {
    bakePie: bakePie(ports),
    servePie: servePie(ports),
    weighBite: weighBite(ports),
    takeBite: takeBite(ports),
    stockStaple: stockStaple(ports),
    dropStaple: dropStaple(ports),
    shelvePie: shelvePie(ports),
    readAppetite: readAppetite(ports),
    readStatement: readStatement(ports),
    takeBites: takeBites(ports),
    recutPie: recutPie(ports),
    resetPie: resetPie(ports),
  };
}

export type Pienance = ReturnType<typeof pienance>;
