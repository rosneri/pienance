import { z } from "zod";
import { browserEventNames, vitalNames, vitalRatings } from "./events";

/** Most items a beacon may carry; the browser batches well below it. */
export const maxBeaconItems = 100;

/** sendBeacon payloads are limited to about 64 KB. */
export const maxBeaconBytes = 60_000;

const path = z
  .string()
  .max(200)
  .regex(/^\/[^?#]*$/, "a path without query or fragment");

const properties = z
  .record(z.string().max(40), z.union([z.string().max(200), z.number().finite(), z.boolean()]))
  .refine((record) => Object.keys(record).length <= 10, "at most 10 properties");

const browserEvent = z.object({
  type: z.literal("event"),
  id: z.uuid(),
  name: z.enum(browserEventNames),
  /** Client clock, epoch milliseconds. */
  at: z.number().int().nonnegative(),
  path,
  referrer: z.string().max(200).optional(),
  properties: properties.default({}),
});

const vital = z.object({
  type: z.literal("vital"),
  /** The web-vitals metric id, unique per page load. */
  id: z.string().min(1).max(100),
  name: z.enum(vitalNames),
  value: z.number().finite().nonnegative(),
  rating: z.enum(vitalRatings).optional(),
  navigationType: z.string().max(40).optional(),
  at: z.number().int().nonnegative(),
  path,
});

const beaconSchema = z.object({
  sessionId: z.uuid(),
  anonymousId: z.uuid(),
  items: z
    .array(z.discriminatedUnion("type", [browserEvent, vital]))
    .min(1)
    .max(maxBeaconItems),
});

export type Beacon = z.infer<typeof beaconSchema>;

export type BeaconItem = Beacon["items"][number];

export type BrowserEvent = z.infer<typeof browserEvent>;

export type Vital = z.infer<typeof vital>;

/** Parses a beacon body sent by a browser; anything malformed is rejected whole. */
export function parseBeacon(body: string): Beacon | null {
  try {
    const parsed = beaconSchema.safeParse(JSON.parse(body));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
