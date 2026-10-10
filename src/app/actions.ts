"use server";

import { revalidatePath } from "next/cache";
import { PieError, roughly, type Verdict } from "@/domain";
import { pienance } from "@/infrastructure/container";

export interface BiteState {
  readonly error?: string;
  readonly weighing?: {
    readonly sliceName: string;
    readonly ofSlice: string;
    readonly ofLeftover: string;
    readonly ofPie: string;
    readonly leftAfter: string;
    readonly verdict: Verdict;
  };
}

function readBite(form: FormData) {
  return {
    sliceId: String(form.get("sliceId") ?? ""),
    amount: Number(form.get("amount")),
    note: String(form.get("note") ?? ""),
  };
}

export async function bakePieAction(form: FormData): Promise<void> {
  await pienance.bakePie({ monthlyIncome: Number(form.get("monthlyIncome")) });
  revalidatePath("/");
}

/** "Weigh it" considers the bite; "Take the bite" records it. */
export async function biteAction(_: BiteState, form: FormData): Promise<BiteState> {
  try {
    const bite = readBite(form);
    if (form.get("intent") === "take") {
      await pienance.takeBite(bite);
      revalidatePath("/");
      return {};
    }
    const weighing = await pienance.weighBite(bite);
    return {
      weighing: {
        sliceName: weighing.slice.name,
        ofSlice: roughly(weighing.ofSlice),
        ofLeftover: roughly(weighing.ofLeftover),
        ofPie: roughly(weighing.ofPie),
        leftAfter: roughly(weighing.leftAfter),
        verdict: weighing.verdict,
      },
    };
  } catch (error) {
    if (error instanceof PieError || error instanceof RangeError) return { error: error.message };
    throw error;
  }
}
