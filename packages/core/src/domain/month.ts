import { Proportion } from "./proportion";

const monthPattern = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** A calendar month (UTC): the period a pie is eaten in. */
export class Month {
  private constructor(
    readonly year: number,
    /** 1-12 */
    readonly month: number,
  ) {}

  static of(date: Date): Month {
    return new Month(date.getUTCFullYear(), date.getUTCMonth() + 1);
  }

  static current(): Month {
    return Month.of(new Date());
  }

  /** Reads "2026-09", the form `toString` gives; anything else is null. */
  static parse(text: string): Month | null {
    const match = monthPattern.exec(text);

    if (!match) return null;

    return new Month(Number(match[1]), Number(match[2]));
  }

  get start(): Date {
    return new Date(Date.UTC(this.year, this.month - 1, 1));
  }

  /** Exclusive upper bound. */
  get end(): Date {
    return new Date(Date.UTC(this.year, this.month, 1));
  }

  contains(date: Date): boolean {
    return date >= this.start && date < this.end;
  }

  next(): Month {
    return Month.of(this.end);
  }

  previous(): Month {
    return Month.of(new Date(this.start.getTime() - 1));
  }

  equals(other: Month): boolean {
    return this.year === other.year && this.month === other.month;
  }

  isAfter(other: Month): boolean {
    return this.start > other.start;
  }

  /** How much of the month has passed at `at`, from none before it starts to whole once it ends. */
  gone(at: Date): Proportion {
    const span = this.end.getTime() - this.start.getTime();
    const passed = at.getTime() - this.start.getTime();

    return Proportion.of(Math.min(Math.max(passed / span, 0), 1));
  }

  toString(): string {
    return `${this.year}-${String(this.month).padStart(2, "0")}`;
  }
}
