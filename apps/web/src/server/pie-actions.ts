import {
  describeAppetite,
  Month,
  PieError,
  viewAppetite,
  viewPie,
  viewShelf,
  viewStaple,
  viewWeighing,
  type AppetiteSentence,
  type BakePieInput,
  type DropStapleInput,
  type Pienance,
  type PieView,
  type ShelfMonthView,
  type StapleView,
  type StockStapleInput,
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
  /** The app's one clock, so pace and the shelf agree with the use cases. */
  readonly now: () => Date;
}

const signInFirst = "Sign in first.";

/** How many past months the shelf holds. */
const shelfSize = 12;

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

  /** A past month on the shelf, or null for junk, the future, or before baking. */
  async function pastPie(ownerId: string, month: string | undefined): Promise<PieView | null> {
    const asked = month ? Month.parse(month) : null;
    let oldest = Month.of(deps.now());

    for (let step = 0; step < shelfSize; step++) oldest = oldest.previous();

    if (!asked || !Month.of(deps.now()).isAfter(asked) || oldest.isAfter(asked)) return null;

    const pie = await deps.app.servePie(ownerId, asked);

    if (!pie || Month.of(pie.bakedAt).isAfter(asked)) return null;

    return viewPie(pie, { month: asked });
  }

  async function thisMonthsStaple(ownerId: string, stapleId: string): Promise<StapleView> {
    const pie = await deps.app.servePie(ownerId);
    const staple = pie?.staples.find((candidate) => candidate.id === stapleId);

    if (!pie || !staple) throw new PieError("That staple is gone");

    return viewStaple(pie, staple, Month.of(deps.now()));
  }

  return {
    /** This month's pie, or a past month's when `month` ("2026-09") is on the shelf. */
    async readPie(month?: string): Promise<PieView | null> {
      const ownerId = await deps.owner();

      if (!ownerId) return null;

      const past = await pastPie(ownerId, month);

      if (past) return past;

      const now = deps.now();
      const current = Month.of(now);
      const pie = await deps.app.servePie(ownerId, current);

      return pie ? viewPie(pie, { month: current, gone: current.gone(now) }) : null;
    },

    /** This month, then the past months newest first; empty until a month has passed. */
    async readShelf(selected?: string): Promise<ShelfMonthView[]> {
      const ownerId = await deps.owner();

      if (!ownerId) return [];

      const current = Month.of(deps.now());

      const [pie, shelf] = await Promise.all([
        deps.app.servePie(ownerId, current),
        deps.app.shelvePie({ ownerId, months: shelfSize }),
      ]);

      if (!pie || shelf.length === 0) return [];

      return viewShelf(
        [{ month: current, pie }, ...shelf],
        (selected ? Month.parse(selected) : null) ?? current,
      );
    },

    /** At most two sentences on how slices are usually eaten; empty before three months. */
    async readAppetite(): Promise<AppetiteSentence[]> {
      const ownerId = await deps.owner();

      if (!ownerId) return [];

      return describeAppetite(viewAppetite(await deps.app.readAppetite({ ownerId })));
    },

    bakePie(input: Asked<BakePieInput>): Promise<Outcome<PieView>> {
      return attempt(async (ownerId) => {
        const pie = await deps.app.bakePie({ ...input, ownerId });
        const now = deps.now();

        deps.track({ name: "pie.baked", properties: { currency: pie.currency.code } }, ownerId);
        deps.refresh();

        return viewPie(pie, { month: Month.of(now), gone: Month.of(now).gone(now) });
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

    stockStaple(input: Asked<StockStapleInput>): Promise<Outcome<StapleView>> {
      return attempt(async (ownerId) => {
        const staple = await deps.app.stockStaple({ ...input, ownerId });

        deps.track(
          { name: "staple.stocked", properties: { replaced: Boolean(input.replaces) } },
          ownerId,
        );
        deps.refresh();

        return thisMonthsStaple(ownerId, staple.id);
      });
    },

    dropStaple(input: Asked<DropStapleInput>): Promise<Outcome<StapleView>> {
      return attempt(async (ownerId) => {
        const staple = await deps.app.dropStaple({ ...input, ownerId });
        const pie = await deps.app.servePie(ownerId);
        const month = Month.of(deps.now());

        if (!pie) throw new PieError("Bake a pie first");

        const view = viewStaple(pie, staple, month);

        deps.track(
          { name: "staple.dropped", properties: { removed: view.endsAfter === undefined } },
          ownerId,
        );
        deps.refresh();

        return view;
      });
    },
  };
}

export type PieActions = ReturnType<typeof pieActions>;
