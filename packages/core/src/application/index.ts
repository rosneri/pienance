import { bakePie } from "./bake-pie";
import type { Ports } from "./ports";
import { servePie } from "./serve-pie";
import { takeBite } from "./take-bite";
import { weighBite } from "./weigh-bite";

export type { BakePieInput } from "./bake-pie";

export type { Ports } from "./ports";

export type { TakeBiteInput } from "./take-bite";

export type { WeighBiteInput } from "./weigh-bite";

export { bakePie, servePie, takeBite, weighBite };

/** Every use case, wired to one set of ports. */
export function pienance(ports: Ports) {
  return {
    bakePie: bakePie(ports),
    servePie: servePie(ports),
    weighBite: weighBite(ports),
    takeBite: takeBite(ports),
  };
}

export type Pienance = ReturnType<typeof pienance>;
