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
}
