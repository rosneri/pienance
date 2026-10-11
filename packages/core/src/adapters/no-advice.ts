import type { Advisor } from "../application/ports";

/** An advisor with no opinion: the rules' guess stands. For tests and running without a model. */
export const noAdvice: Advisor = {
  layoutOf: async (_rows, guess) => guess,
  slicesFor: async (notes) => notes.map(() => null),
};
