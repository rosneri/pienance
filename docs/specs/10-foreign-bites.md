# Foreign bites

Status: proposed · Depends on: nothing

## Why

A pie is in one currency, but people buy things abroad and online in others. Today those bites
cannot be weighed or taken at all ("This pie is in EUR, not USD").

## Language

| Term             | Meaning                                                               |
| ---------------- | --------------------------------------------------------------------- |
| **Foreign bite** | A bite paid in another currency, converted into the pie's currency.   |
| **Rate**         | How much of the pie's currency one unit of another currency is worth. |

## Behaviour

- Weigh and take accept any ISO 4217 currency. The pie's currency stays the default.
- Weighing converts at today's rate. Taking fixes the rate on the bite, so the month never
  shifts when rates move.
- The answer says it converted: "Fits. Paid in USD, it is about a tenth of Wants."
- The bite list shows the paid amount's currency, not the rate.
- If no rate can be found, weighing and taking fail with "No rate for USD today. Try again
  later or enter it in EUR." They never guess.

## Design

### Core

- `domain/rate.ts`: `Rate { from: Currency, to: Currency, value: string, on: Date }`. The value is
  a decimal string, turned into Dinero's scaled rate so no float touches money.
- `Money.convert(rate: Rate): Money` using Dinero `convert`, rounded half-even.
- `Bite` gains `paid?: Money`. `amount` stays in the pie's currency, so `Pie` is unchanged.
- `Ports` gains `rates: ExchangeRates` with
  `rate(from: Currency, to: Currency, on: Date): Promise<Rate | null>`.
- `weighBite` and `takeBite` take an optional `currency` and convert before calling the pie.
- `adapters/`: `FixedExchangeRates` for tests and the in-memory app.

### Adapter

- The real adapter lives in the web app (`apps/web/src/server`), since core has no `fetch`. It
  reads daily reference rates from a free source such as the ECB feed or frankfurter.app, cached
  for the day.
- Wired in `apps/web/src/pienance.ts` only.

### Persistence

`Bite.paidCurrency String?`, `Bite.paidMinor BigInt?`.

### Web

- A currency select next to the amount in the weigh form, defaulting to the pie's currency.
- `currency-symbol.ts` already exists for the prefix.

### Agent tools

`weigh_bite` and `take_bite` gain an optional `currency`.

## Tests

- Unit: `convert` across exponents (JPY to EUR, EUR to KWD) with exact expectations.
- Integration: a foreign bite keeps its rate after reload; missing rate yields an `Outcome` error.
- Adapter: the HTTP adapter parses a recorded response, passed in as a plain `fetch` function.

## Out of scope

- Card fees and spreads on top of the rate.
- Pies in more than one currency.
