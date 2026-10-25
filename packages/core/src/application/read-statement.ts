import {
  guessLayout,
  isTransactions,
  Month,
  PieError,
  readSpends,
  type StatementLayout,
} from "../domain";
import type { Ports, Rows } from "./ports";

export interface ReadStatementInput {
  readonly ownerId: string;
  readonly rows: Rows;
  /** How to read it, when the person corrected the guess. */
  readonly layout?: StatementLayout | undefined;
}

/** A bite read from a statement, not taken yet. Plain, so it can travel to the person and back. */
export interface DraftBite {
  /** The day it was spent: "2026-10-03". */
  readonly eatenOn: string;
  /** In the pie's currency: "12.50". */
  readonly amount: string;
  readonly note: string;
  readonly sliceId: string;
}

export interface StatementPreview {
  readonly layout: StatementLayout;
  /** One name per column: the file's own, or "Column 1", "Column 2"… */
  readonly header: readonly string[];
  readonly bites: readonly DraftBite[];
  /** Rows of money coming in, which are not bites. */
  readonly incoming: number;
  readonly unreadable: number;
}

const notTransactions = "This file does not look like a list of transactions";

/** The most bites one statement may hold: a few months of a busy account. */
export const mostBites = 2_000;

/** Reads a bank statement into draft bites, each with a suggested slice, without taking any. */
export function readStatement(ports: Ports) {
  return async (input: ReadStatementInput): Promise<StatementPreview> => {
    const pie = await ports.pies.find(input.ownerId, Month.of(ports.now()));

    if (!pie) throw new PieError("Bake a pie first");

    const guess = guessLayout(input.rows);

    const layout =
      input.layout ??
      (guess.sure ? guess.layout : await ports.advisor.layoutOf(input.rows, guess.layout));

    if (!layout?.columns.includes("date")) throw new PieError(notTransactions);

    const reading = readSpends(input.rows, layout, pie.currency);

    if (!isTransactions(reading)) throw new PieError(notTransactions);

    if (reading.spends.length > mostBites) {
      throw new PieError(`That is over ${mostBites} bites: import a few months at a time`);
    }

    const notes = [...new Set(reading.spends.map((spend) => spend.note))];
    const suggested = await ports.advisor.slicesFor(notes, pie.liveSlices);
    const sliceOf = new Map(notes.map((note, index) => [note, suggested[index]]));
    const known = new Set(pie.liveSlices.map((slice) => slice.id));
    const fallback = pie.liveSlices[0]?.id ?? "";
    const names = input.rows[layout.skipRows - 1] ?? [];

    return {
      layout,
      header: layout.columns.map((_, index) => names[index]?.trim() || `Column ${index + 1}`),
      bites: reading.spends.map((spend) => {
        const sliceId = sliceOf.get(spend.note);

        return {
          eatenOn: spend.eatenOn.toISOString().slice(0, 10),
          amount: spend.amount.toDecimal(),
          note: spend.note,
          sliceId: sliceId && known.has(sliceId) ? sliceId : fallback,
        };
      }),
      incoming: reading.incoming,
      unreadable: reading.unreadable,
    };
  };
}
