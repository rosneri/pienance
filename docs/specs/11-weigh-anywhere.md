# Weigh anywhere

Status: proposed · Depends on: nothing

## Why

"Is this worth it?" comes up in a shop or on a product page, not on the pienance home page. The
question should be one tap away.

## Behaviour

- Pienance installs as a web app on the home screen.
- A "Weigh something" shortcut opens the page with the price field focused.
- On platforms that support share targets, sharing a product page or a text to pienance opens
  the weigh form with:
  - the note set to the shared title, cut at 60 characters,
  - the price set to the first amount found in the shared text, then title, then URL, if any.
- Finding an amount: the first run of digits with optional thousands separators and an
  optional decimal part; currency symbols and words are ignored. The last "." or "," followed
  by one or two digits is the decimal mark; other separators are thousands. "$1,299.00" is
  1299.00, "12,50 €" is 12.50, "129" is 129, "1.299" is 1299. The result is parsed with
  `Money.parse` in the given currency, so it is rounded to that currency's minor unit.
- The form is only prefilled. Nothing is weighed or taken until the person submits.
- Signed-out people land on sign-in and return to the prefilled form afterwards.
- Interactions:
  - Foreign bites (10): a recognised symbol or code in the shared text preselects that
    currency. Without it, the pie's currency.
  - Agent tools (12): nothing new; agents already reach `weigh_bite`.

## Design

### Core

- `Money.findIn(text: string, currency: Currency): Money | null`, with the rules above. Pure
  and tested, reusable by the native app's share sheet later. It never throws.

### Web

- `app/manifest.ts`: name, icons, `background_color` and `theme_color` from the tokens'
  light values, `display: "standalone"`, `shortcuts` with "Weigh something" → `/?weigh=1`,
  and `share_target` (GET) → `/?weigh=1` with `title`, `text` and `url` parameters.
- `app/icon.tsx` and `app/apple-icon.tsx` render the pie from `wedgePath` with `ImageResponse`,
  so the icon is the product.
- `page.tsx` reads `weigh`, `title`, `text` and `url` from `searchParams`, finds the amount
  with `Money.findIn` in the pie's currency, and passes `initialAmount`, `initialNote` and
  `autoFocus` to `WeighForm`.
- Sign-in gains a `next` parameter: `page.tsx` redirects to `/sign-in?next=<path and query>`,
  and the `signIn` action redirects there after success. Only paths starting with "/" and
  not "//" are accepted; anything else goes to "/".

### Agent tools

None.

## UX

- **Install.** No custom install banner; browsers have their own. Where the browser fires
  `beforeinstallprompt`, the masthead menu shows "Add to home screen" and calls it. Elsewhere
  it is hidden.
- **Shortcut.** Long-pressing the icon offers "Weigh something". The page opens scrolled to the
  weigh form with the price focused and the numeric keyboard up (`inputMode="decimal"` is
  already set).
- **Share.** The form opens prefilled, with one muted line above it:
  - Price found: "Found 399.00 in what you shared. Check it, then weigh." The number is the
    person's own, so it is shown as typed.
  - No price: "No price in what you shared." The price field is focused instead.
- **Signed out.** Sign-in first, then straight back to the prefilled form.

## Acceptance criteria

- [ ] `Money.findIn` handles "$1,299.00", "12,50 €", "129", "1.299", text with no amount
      (null) and text with several amounts (the first).
- [ ] The manifest lists the shortcut and the share target, both pointing at `/`.
- [ ] `/?weigh=1` focuses the price field; `/?weigh=1&title=…&text=…` prefills note and price.
- [ ] Nothing is weighed or taken on open.
- [ ] A signed-out visit to a prefilled URL returns to that URL after sign-in; an external
      `next` is ignored.
- [ ] The icon routes render.

## Tests

- Unit: `Money.findIn` with the cases above.
- Component: `WeighForm` prefill and focus props.
- Manifest: a test asserts shortcuts and share target point at existing routes.
- Server: `signIn` honours a safe `next` and drops an unsafe one.

## Out of scope

- Offline use and a service worker.
- iOS share sheet, which does not support web share targets. The native app covers it later.
