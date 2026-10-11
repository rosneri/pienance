import { bakePie } from "./bake-pie";
import { dropStaple } from "./drop-staple";
import { moveBite } from "./move-bite";
import type { Ports } from "./ports";
import { putBackBite } from "./put-back-bite";
import { readAppetite } from "./read-appetite";
import { readStatement } from "./read-statement";
import { previewReslice, reslicePie } from "./reslice-pie";
import { servePie } from "./serve-pie";
import { shelvePie } from "./shelve-pie";
import { stockStaple } from "./stock-staple";
import { takeBite } from "./take-bite";
import { takeBites } from "./take-bites";
import { weighBite } from "./weigh-bite";

export type { BakePieInput } from "./bake-pie";

export type { DropStapleInput } from "./drop-staple";

export type { Advisor, Ports, Rows } from "./ports";

export type { MoveBiteInput } from "./move-bite";

export type { PutBackBiteInput } from "./put-back-bite";

export type { DraftBite, ReadStatementInput, StatementPreview } from "./read-statement";

export type { ReadAppetiteInput, SliceAppetite } from "./read-appetite";

export type { ResliceInput } from "./reslice-pie";

export type { Shelved, ShelvePieInput } from "./shelve-pie";

export type { StockStapleInput } from "./stock-staple";

export type { TakeBiteInput } from "./take-bite";

export type { TakenBites, TakeBitesInput } from "./take-bites";

export type { WeighBiteInput } from "./weigh-bite";

export { mostBites } from "./read-statement";

export { shareStep } from "./reslice-pie";

export {
  bakePie,
  dropStaple,
  moveBite,
  previewReslice,
  putBackBite,
  readAppetite,
  readStatement,
  reslicePie,
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
    putBackBite: putBackBite(ports),
    moveBite: moveBite(ports),
    reslicePie: reslicePie(ports),
    previewReslice: previewReslice(ports),
    stockStaple: stockStaple(ports),
    dropStaple: dropStaple(ports),
    shelvePie: shelvePie(ports),
    readAppetite: readAppetite(ports),
    readStatement: readStatement(ports),
    takeBites: takeBites(ports),
  };
}

export type Pienance = ReturnType<typeof pienance>;
