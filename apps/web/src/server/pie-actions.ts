import {
  PieError,
  viewPie,
  viewWeighing,
  type BakePieInput,
  type Pienance,
  type PieView,
  type StatementLayout,
  type StatementPreview,
  type TakeBiteInput,
  type TakenBites,
  type TakeBitesInput,
  type WeighBiteInput,
  type WeighingView,
} from "@pienance/core";
import type { ProductEvent } from "@pienance/telemetry/contract";
import { rowsOf } from "@/import/csv";
import { largestStatement } from "@/import/lines";
import { failed, succeeded, type Outcome } from "./outcome";

/** A bank statement as uploaded, and how to read it when the person corrected the guess. */
export interface StatementUpload {
  readonly csv: string;
  readonly layout?: StatementLayout | undefined;
}

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

    readStatement(upload: StatementUpload): Promise<Outcome<StatementPreview>> {
      return attempt(async (ownerId) => {
        if (upload.csv.length > largestStatement) {
          throw new RangeError("That file is too big: export a few months at a time");
        }

        const preview = await deps.app.readStatement({
          ownerId,
          rows: rowsOf(upload.csv),
          layout: upload.layout,
        });

        deps.track(
          { name: "statement.read", properties: { bites: preview.bites.length } },
          ownerId,
        );

        return preview;
      });
    },

    takeBites(input: Asked<TakeBitesInput>): Promise<Outcome<TakenBites>> {
      return attempt(async (ownerId) => {
        const taken = await deps.app.takeBites({ ...input, ownerId });

        deps.track({ name: "bites.taken", properties: taken }, ownerId);
        deps.refresh();

        return taken;
      });
    },
  };
}

export type PieActions = ReturnType<typeof pieActions>;
