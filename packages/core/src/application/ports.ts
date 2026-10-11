import type { PieRepository, Slice, StatementLayout } from "../domain";

/** Rows of a CSV file, as parsed by the platform. */
export type Rows = readonly (readonly string[])[];

/**
 * A second opinion, usually a model, for what plain rules cannot tell for sure.
 * It may answer "don't know" (null) at any time; the use cases then fall back.
 */
export interface Advisor {
  /** How to read a statement the rules were unsure about, or null if it holds no transactions. */
  layoutOf(rows: Rows, guess: StatementLayout | null): Promise<StatementLayout | null>;
  /** The id of the slice each note most likely eats from, or null where unsure. */
  slicesFor(
    notes: readonly string[],
    slices: readonly Slice[],
  ): Promise<readonly (string | null)[]>;
}

/**
 * What the use cases need from the outside world. Each platform (web server,
 * native app, tests) supplies its own: nothing here assumes Node or a browser.
 */
export interface Ports {
  readonly pies: PieRepository;
  readonly advisor: Advisor;
  readonly newId: () => string;
  readonly now: () => Date;
}
