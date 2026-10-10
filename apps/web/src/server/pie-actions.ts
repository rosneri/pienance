import {
  PieError,
  viewPie,
  viewWeighing,
  type BakePieInput,
  type Pienance,
  type PieView,
  type TakeBiteInput,
  type WeighBiteInput,
  type WeighingView,
} from "@pienance/core";
import type { ProductEvent } from "@pienance/telemetry/contract";
import { failed, succeeded, type Outcome } from "./outcome";

/** What a signed-in person sends; who they are comes from their session. */
export type Asked<T> = Omit<T, "ownerId">;

export interface PieActionsDeps {
  readonly app: Pienance;
  /** The signed-in user's id, or null. */
  readonly owner: () => Promise<string | null>;
  /** Re-renders the page after a change. */
  readonly refresh: () => void;
  /** Records a product event for the signed-in user. */
  readonly track: (event: ProductEvent, ownerId: string) => void;
}

const signInFirst = "Sign in first.";

/** The pie features as plain async functions, independent of Next.js. */
export function pieActions(deps: PieActionsDeps) {
  async function attempt<T>(run: (ownerId: string) => Promise<T>): Promise<Outcome<T>> {
    const ownerId = await deps.owner();

    if (!ownerId) return failed(signInFirst);

    try {
      return succeeded(await run(ownerId));
    } catch (error) {
      if (error instanceof PieError || error instanceof RangeError) return failed(error.message);

      throw error;
    }
  }

  return {
    async readPie(): Promise<PieView | null> {
      const ownerId = await deps.owner();
      const pie = ownerId ? await deps.app.servePie(ownerId) : null;

      return pie ? viewPie(pie) : null;
    },

    bakePie(input: Asked<BakePieInput>): Promise<Outcome<PieView>> {
      return attempt(async (ownerId) => {
        const pie = await deps.app.bakePie({ ...input, ownerId });

        deps.track({ name: "pie.baked", properties: { currency: pie.currency.code } }, ownerId);
        deps.refresh();

        return viewPie(pie);
      });
    },

    weighBite(input: Asked<WeighBiteInput>): Promise<Outcome<WeighingView>> {
      return attempt(async (ownerId) => {
        const weighing = await deps.app.weighBite({ ...input, ownerId });

        deps.track({ name: "bite.weighed", properties: { verdict: weighing.verdict } }, ownerId);

        return viewWeighing(weighing);
      });
    },

    takeBite(input: Asked<TakeBiteInput>): Promise<Outcome<string>> {
      return attempt(async (ownerId) => {
        const bite = await deps.app.takeBite({ ...input, ownerId });

        deps.track({ name: "bite.taken", properties: {} }, ownerId);
        deps.refresh();

        return bite.id;
      });
    },
  };
}

export type PieActions = ReturnType<typeof pieActions>;
