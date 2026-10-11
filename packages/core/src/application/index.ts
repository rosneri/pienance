import { bakePie } from "./bake-pie";
import { dropStaple } from "./drop-staple";
import type { Ports } from "./ports";
import { readAppetite } from "./read-appetite";
import { servePie } from "./serve-pie";
import { shelvePie } from "./shelve-pie";
import { stockStaple } from "./stock-staple";
import { takeBite } from "./take-bite";
import { weighBite } from "./weigh-bite";

export type { BakePieInput } from "./bake-pie";

export type { DropStapleInput } from "./drop-staple";

export type { Ports } from "./ports";

export type { ReadAppetiteInput, SliceAppetite } from "./read-appetite";

export type { Shelved, ShelvePieInput } from "./shelve-pie";

export type { StockStapleInput } from "./stock-staple";

export type { TakeBiteInput } from "./take-bite";

export type { WeighBiteInput } from "./weigh-bite";

export { bakePie, dropStaple, readAppetite, servePie, shelvePie, stockStaple, takeBite, weighBite };

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
  };
}

export type Pienance = ReturnType<typeof pienance>;
