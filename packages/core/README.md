# @pienance/core

The whole business of pienance in pure TypeScript: no framework, no DOM, no Node APIs.
Any runtime can use it — the Next.js web app today, a React Native app tomorrow.

- `domain/` — Pie, Slice, Bite, Money, Proportion, Month and `roughly()`.
- `application/` — use cases (`bakePie`, `servePie`, `weighBite`, `takeBite`) and their `Ports`.
- `presentation/` — serialisable views (`viewPie`, `viewWeighing`) every surface renders.
- `adapters/` — `InMemoryPieRepository`, for tests and offline use.

A platform wires it once:

```ts
const app = pienance({ pies, newId: () => crypto.randomUUID(), now: () => new Date() });
await app.weighBite({ sliceId, amount: 42 });
```
