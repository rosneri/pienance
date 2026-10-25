/** Product events, named in the ubiquitous language. Never carry amounts or incomes. */
export type ProductEvent =
  | { readonly name: "pie.baked"; readonly properties: { readonly currency: string } }
  | {
      readonly name: "pie.resliced";
      readonly properties: { readonly slices: number; readonly retired: number };
    }
  | { readonly name: "bite.weighed"; readonly properties: { readonly verdict: string } }
  | { readonly name: "bite.taken"; readonly properties: Readonly<Record<string, never>> }
  | { readonly name: "bite.put-back"; readonly properties: Readonly<Record<string, never>> }
  | { readonly name: "bite.moved"; readonly properties: Readonly<Record<string, never>> }
  | { readonly name: "staple.stocked"; readonly properties: { readonly replaced: boolean } }
  | { readonly name: "staple.dropped"; readonly properties: { readonly removed: boolean } }
  | {
      readonly name: "statement.read";
      readonly properties: { readonly bites: number; readonly trimmed: boolean };
    }
  | {
      readonly name: "bites.taken";
      readonly properties: { readonly taken: number; readonly duplicates: number };
    };

/** Clickstream events the browser sends. */
export const browserEventNames = ["$pageview", "$click", "$leave"] as const;

export type BrowserEventName = (typeof browserEventNames)[number];

export const vitalNames = ["LCP", "INP", "CLS", "FCP", "TTFB"] as const;

export type VitalName = (typeof vitalNames)[number];

export const vitalRatings = ["good", "needs-improvement", "poor"] as const;

export type VitalRating = (typeof vitalRatings)[number];

/** A flat property value; nested data does not belong in an event. */
export type PropertyValue = string | number | boolean;

export type Properties = Readonly<Record<string, PropertyValue>>;
