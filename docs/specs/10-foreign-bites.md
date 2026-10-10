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
- Weighing converts at today's rate. Taking converts once and stores both the paid amount and
  the converted amount on the bite, so the month never shifts when rates move. The rate itself
  is not stored; the two amounts say everything.
- Conversion rounds half-even to the pie currency's minor unit, as `Money.parse` does.
- The answer says it converted: "Fits. Paid in USD, it is about a tenth of Wants."
- The bite list shows the paid currency, not the rate.
- If no rate can be found, weighing and taking fail with "No rate for USD today. Try again
  later or enter it in EUR." They never guess.
- Interactions:
  - Spread (05): the whole amount is converted, then split.
  - Sweep (09): the sweep is computed on the converted amount.
  - Staples (04): staples are in the pie's currency only.
  - Agent tools (12): `find_room` takes the same optional `currency`.

## Design

### Core

- `domain/rate.ts`: `Rate { from: Currency, to: Currency, value: string, on: Date }`. The value
  is a decimal string such as "0.9213". `Money.convert` turns it into Dinero's
  `{ amount, scale }` rate, so no float touches money.
- `Money.convert(rate: Rate): Money`: Dinero `convert`, then `transformScale` to the target
  currency's exponent with `halfEven`, because Dinero keeps the rate's extra scale. Throws
  `RangeError` when `rate.from` is not this money's currency.
- `Bite` gains `paid?: Money`. `amount` stays in the pie's currency, so `Pie` is unchanged.
- `Ports` gains `rates: ExchangeRates` with
  `rate(from: Currency, to: Currency, on: Date): Promise<Rate | null>`.
- `weighBite` and `takeBite` take an optional `currency` (ISO code). When it is the pie's
  currency, nothing changes. Otherwise they ask `ports.rates` for `on = ports.now()`, throw
  `PieError` with the sentence above when null, convert, and set `paid` on the bite.
- `adapters/`: `FixedExchangeRates` built from a table, for tests and the in-memory app.

### Adapter

- The real adapter lives in the web app (`apps/web/src/server/frankfurter-rates.ts`), since
  core has no `fetch`. It reads daily reference rates from frankfurter.app, takes `fetch` as a
  constructor argument, and caches each pair per UTC day in a module map. A currency the
  source does not know yields null, hence "No rate".
- Wired in `apps/web/src/pienance.ts` only; the in-memory app uses `FixedExchangeRates`.

### Persistence

`Bite.paidCurrency String?`, `Bite.paidMinor BigInt?`.

### Web

- `weighBite` and `takeBite` server actions gain optional `currency`.
- A currency select next to the amount in the weigh form, defaulting to the pie's currency,
  listing `currencyCodes`.
- `currency-symbol.ts` already exists for the prefix.
- `BiteView.paidIn?: string` (ISO code) for the row suffix.

### Agent tools

`weigh_bite` and `take_bite` gain an optional `currency` (ISO 4217 code).

## UX

- **Price field.** A currency select joined to the left of the amount input, as one control,
  using `native-select`. Order: the pie's currency, then up to three currencies this viewer
  used recently (`localStorage`), then all of them. The label stays "Price".
- **Default.** Always the pie's currency, so a foreign bite is a deliberate choice.
- **Answer.** "Fits. Paid in USD, it is about a tenth of Wants." "Weighing…" also covers the
  rate lookup.
- **No rate.** The destructive answer line, with the currency left selected so a retry is one
  tap.
- **Bite row.** A muted suffix: "Hotel · about a fifth of Wants · paid in USD".

## Acceptance criteria

- [ ] `Money.convert` gives exact results across exponents (JPY to EUR, EUR to KWD, EUR to
      JPY) and rounds half-even to the target's minor unit.
- [ ] A rate whose `from` is another currency is refused.
- [ ] Weighing in the pie's currency never calls the rates port.
- [ ] A missing rate yields the "No rate for USD today…" `Outcome` error, not a throw.
- [ ] A taken foreign bite reloads with the same `amount` and `paid`, whatever the rate is now.
- [ ] The answer and the bite row name the paid currency.
- [ ] The web adapter parses a recorded frankfurter response and caches it for the day.
- [ ] `weigh_bite` and `take_bite` accept `currency`.

## Tests

- Unit: `convert` across exponents with exact expectations; refusal on a mismatched rate.
- Integration: a foreign bite keeps both amounts after reload; a missing rate yields an
  `Outcome` error; the pie's own currency skips the port (a port that throws proves it).
- Adapter: parses a recorded response, passed in as a plain `fetch` function; null for an
  unknown currency.

## Out of scope

- Card fees and spreads on top of the rate.
- Pies in more than one currency.
- Showing or editing the rate.
