"use server";

import {
  PieError,
  viewPie,
  viewWeighing,
  type BakePieInput,
  type PieView,
  type TakeBiteInput,
  type WeighBiteInput,
  type WeighingView,
} from "@pienance/core";
import { revalidatePath } from "next/cache";
import { pienance } from "@/pienance";

/** Server actions never throw expected errors: the UI and agents get them as values. */
export type Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

async function attempt<T>(run: () => Promise<T>): Promise<Outcome<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    if (error instanceof PieError || error instanceof RangeError) {
      return { ok: false, error: error.message };
    }

    throw error;
  }
}

export async function readPie(): Promise<PieView | null> {
  const pie = await pienance.servePie();

  return pie ? viewPie(pie) : null;
}

export async function bakePie(input: BakePieInput): Promise<Outcome<PieView>> {
  return attempt(async () => {
    const pie = await pienance.bakePie(input);

    revalidatePath("/");

    return viewPie(pie);
  });
}

export async function weighBite(input: WeighBiteInput): Promise<Outcome<WeighingView>> {
  return attempt(async () => viewWeighing(await pienance.weighBite(input)));
}

export async function takeBite(input: TakeBiteInput): Promise<Outcome<string>> {
  return attempt(async () => {
    const bite = await pienance.takeBite(input);

    revalidatePath("/");

    return bite.id;
  });
}
