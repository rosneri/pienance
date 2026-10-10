import type { DineroCurrency } from "dinero.js";
import * as iso4217 from "dinero.js/currencies";

/** An ISO 4217 currency, as defined by Dinero.js (code, base and minor-unit exponent). */
export type Currency = DineroCurrency<number>;

const currencies = new Map<string, Currency>(
  Object.values(iso4217).map((currency) => [currency.code, currency]),
);

/** Every supported ISO 4217 code, sorted. */
export const currencyCodes: readonly string[] = [...currencies.keys()].toSorted();

/** Parses a currency code such as "EUR" or "jpy". */
export function currencyOf(code: string): Currency {
  const currency = currencies.get(code.trim().toUpperCase());

  if (!currency) throw new RangeError(`Unknown currency "${code}"`);

  return currency;
}
