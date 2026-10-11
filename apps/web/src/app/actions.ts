"use server";

import { ownerOf } from "@pienance/auth";
import type {
  AppetiteSentence,
  BakePieInput,
  DropStapleInput,
  PieView,
  ShelfMonthView,
  StapleView,
  StockStapleInput,
  TakeBiteInput,
  WeighBiteInput,
  WeighingView,
} from "@pienance/core";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, clock, pienance, track } from "@/pienance";
import { accountActions, type Credentials, type SignUpDetails } from "@/server/account-actions";
import type { Outcome } from "@/server/outcome";
import { pieActions, type Asked } from "@/server/pie-actions";

// Thin Next.js wrappers: the logic lives in src/server, where it is tested.

const pies = pieActions({
  app: pienance,
  owner: async () => ownerOf(auth(), await headers()),
  refresh: () => revalidatePath("/"),
  track,
  now: clock,
});

const accounts = () => accountActions(auth(), headers);

export async function readPie(month?: string): Promise<PieView | null> {
  return pies.readPie(month);
}

export async function readShelf(selected?: string): Promise<ShelfMonthView[]> {
  return pies.readShelf(selected);
}

export async function readAppetite(): Promise<AppetiteSentence[]> {
  return pies.readAppetite();
}

export async function bakePie(input: Asked<BakePieInput>): Promise<Outcome<PieView>> {
  return pies.bakePie(input);
}

export async function weighBite(input: Asked<WeighBiteInput>): Promise<Outcome<WeighingView>> {
  return pies.weighBite(input);
}

export async function takeBite(input: Asked<TakeBiteInput>): Promise<Outcome<string>> {
  return pies.takeBite(input);
}

export async function stockStaple(input: Asked<StockStapleInput>): Promise<Outcome<StapleView>> {
  return pies.stockStaple(input);
}

export async function dropStaple(input: Asked<DropStapleInput>): Promise<Outcome<StapleView>> {
  return pies.dropStaple(input);
}

export async function signUp(details: SignUpDetails): Promise<Outcome<null>> {
  const outcome = await accounts().signUp(details);

  if (outcome.ok) redirect("/");

  return outcome;
}

export async function signIn(credentials: Credentials): Promise<Outcome<null>> {
  const outcome = await accounts().signIn(credentials);

  if (outcome.ok) redirect("/");

  return outcome;
}

export async function signOut(): Promise<void> {
  await accounts().signOut();
  redirect("/sign-in");
}
