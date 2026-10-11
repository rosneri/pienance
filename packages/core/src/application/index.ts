import { bakePie } from "./bake-pie";
import { carryOver, dropCarry, readCarryOffer } from "./carry-over";
import { dropStaple } from "./drop-staple";
import { moveBite } from "./move-bite";
import type { Ports } from "./ports";
import { putBackBite } from "./put-back-bite";
import { putBackSpread } from "./put-back-spread";
import { readAppetite } from "./read-appetite";
import { readStatement } from "./read-statement";
import { previewReslice, reslicePie } from "./reslice-pie";
import { servePie } from "./serve-pie";
import { shelvePie } from "./shelve-pie";
import { stockStaple } from "./stock-staple";
import { takeBite } from "./take-bite";
import { takeBites } from "./take-bites";
import { takeSpread } from "./take-spread";
import { weighBite } from "./weigh-bite";

export type { BakePieInput } from "./bake-pie";

export type { CarryOffer, CarryOfferInput, CarryOverInput } from "./carry-over";

export type { DropStapleInput } from "./drop-staple";

export type { Advisor, Ports, Rows } from "./ports";

export type { MoveBiteInput } from "./move-bite";

export type { PutBackBiteInput } from "./put-back-bite";

export type { PutBackSpreadInput } from "./put-back-spread";

export type { DraftBite, ReadStatementInput, StatementPreview } from "./read-statement";

export type { ReadAppetiteInput, SliceAppetite } from "./read-appetite";

export type { ResliceInput } from "./reslice-pie";

export type { Shelved, ShelvePieInput } from "./shelve-pie";

export type { StockStapleInput } from "./stock-staple";

export type { TakeBiteInput } from "./take-bite";

export type { TakenBites, TakeBitesInput } from "./take-bites";

export type { TakeSpreadInput } from "./take-spread";

export type { WeighBiteInput } from "./weigh-bite";

export { mostBites } from "./read-statement";

export { shareStep } from "./reslice-pie";

export {
  bakePie,
  carryOver,
  dropCarry,
  dropStaple,
  moveBite,
  previewReslice,
  putBackBite,
  putBackSpread,
  readAppetite,
  readCarryOffer,
  readStatement,
  reslicePie,
  servePie,
  shelvePie,
  stockStaple,
  takeBite,
  takeBites,
  takeSpread,
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
    takeSpread: takeSpread(ports),
    putBackSpread: putBackSpread(ports),
    moveBite: moveBite(ports),
    reslicePie: reslicePie(ports),
    previewReslice: previewReslice(ports),
    readCarryOffer: readCarryOffer(ports),
    carryOver: carryOver(ports),
    dropCarry: dropCarry(ports),
    stockStaple: stockStaple(ports),
    dropStaple: dropStaple(ports),
    shelvePie: shelvePie(ports),
    readAppetite: readAppetite(ports),
    readStatement: readStatement(ports),
    takeBites: takeBites(ports),
  };
}

export type Pienance = ReturnType<typeof pienance>;
