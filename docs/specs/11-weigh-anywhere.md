# Weigh anywhere

Status: proposed · Depends on: nothing

## Why

"Is this worth it?" comes up in a shop or on a product page, not on the pienance home page. The
question should be one tap away.

## Behaviour

- Pienance installs as a web app on the home screen.
- A "Weigh something" shortcut opens the page with the amount field focused.
- On platforms that support share targets, sharing a product page or a text to pienance opens
  the weigh form with:
  - the note set to the shared title,
  - the amount set to the first price found in the shared text, if any.
- The form is only prefilled. Nothing is weighed or taken until the person submits.
- Signed-out people land on sign-in and return to the prefilled form afterwards.

## Design

### Core

- `Money.findIn(text: string, currency: Currency): Money | null`: the first decimal amount in
  free text, ignoring currency symbols and thousands separators. Pure and tested, reusable by
  the native app's share sheet later.

### Web

- `app/manifest.ts`: name, icons, theme colours from the tokens, `display: "standalone"`,
  `shortcuts` with "Weigh something" → `/?weigh`, and `share_target` (GET) → `/?weigh` with
  `title`, `text` and `url` parameters.
- `page.tsx` reads `weigh`, `title` and `text` from search params and passes `initialAmount`,
  `initialNote` and `autoFocus` to `WeighForm`.
- `sign-in` keeps a `next` parameter so the prefill survives signing in.
- Icons rendered from the pie geometry, so the icon is the product.

### Agent tools

None. Agents already reach `weigh_bite` directly.

## UX

- **Install.** No custom install banner; browsers have their own. Where the browser exposes the
  install prompt, the masthead menu shows "Add to home screen". Elsewhere it is hidden.
- **Shortcut.** Long-pressing the icon offers "Weigh something". The page opens scrolled to the
  weigh form with the price focused and the numeric keyboard up.
- **Share.** The form opens prefilled, with one muted line above it:
  - Price found: "Found 399.00 in what you shared. Check it, then weigh."
  - No price: "No price in what you shared." The price field is focused instead.
  - The note is the shared title, cut at 60 characters.
- **Currency.** With Foreign bites built, a recognised symbol preselects that currency.
- **Signed out.** Sign-in first, then straight back to the prefilled form.

## Tests

- Unit: `Money.findIn` with "$1,299.00", "12,50 €", "129", no amount, and several amounts.
- Component: `WeighForm` prefill and focus props.
- Manifest: a test asserts shortcuts and share target point at existing routes.

## Out of scope

- Offline use and a service worker.
- iOS share sheet, which does not support web share targets. The native app covers it later.
