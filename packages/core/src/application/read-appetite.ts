import { appetiteOf, Month, type Appetite, type Proportion, type Slice } from "../domain";
import type { Ports } from "./ports";
import { shelvePie } from "./shelve-pie";

export interface ReadAppetiteInput {
  readonly ownerId: string;
}

export interface SliceAppetite {
  readonly slice: Slice;
  readonly appetite: Appetite;
}

/** The last three complete months a habit is read from. */
const months = 3;

/**
 * How each live slice is usually eaten, from the three months before this one.
 * Empty until there are three such months since baking.
 */
export function readAppetite(ports: Ports) {
  return async (input: ReadAppetiteInput): Promise<SliceAppetite[]> => {
    const [pie, shelf] = await Promise.all([
      ports.pies.find(input.ownerId, Month.of(ports.now())),
      shelvePie(ports)({ ownerId: input.ownerId, months }),
    ]);

    if (!pie || shelf.length < months) return [];

    return pie.slices.flatMap((slice) => {
      const eaten = shelf.flatMap(({ pie: past }): Proportion[] => {
        const serving = past.servings().find((candidate) => candidate.slice.id === slice.id);

        return serving ? [serving.eaten] : [];
      });

      const appetite = appetiteOf(eaten);

      return appetite ? [{ slice, appetite }] : [];
    });
  };
}
