"use server";

import { ownerOf } from "@pienance/auth";
import type {
  AppetiteSentence,
  BakePieInput,
  BiteView,
  CarryOfferView,
  CarryOverInput,
  DropStapleInput,
  MoveBiteInput,
  PieView,
  PutBackBiteInput,
  PutBackSpreadInput,
  ResliceInput,
  ReslicePreview,
  ResliceView,
  SweepChoice,
  ShelfMonthView,
  StapleView,
  StockStapleInput,
  TakenBites,
  TakeBitesInput,
  WeighBiteInput,
  WeighingView,
} from "@pienance/core";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, clock, pienance, track } from "@/pienance";
import { accountActions, type Credentials, type SignUpDetails } from "@/server/account-actions";
import type { Outcome } from "@/server/outcome";
import {
  pieActions,
  type Asked,
  type BiteToTake,
  type StatementReading,
  type StatementUpload,
} from "@/server/pie-actions";

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

export async function readCarryOffer(): Promise<CarryOfferView | null> {
  return pies.readCarryOffer();
}

export async function carryOver(input: Asked<CarryOverInput>): Promise<Outcome<PieView>> {
  return pies.carryOver(input);
}

export async function dropCarry(): Promise<Outcome<PieView>> {
  return pies.dropCarry();
}

export async function setSweep(input: SweepChoice): Promise<Outcome<PieView>> {
  return pies.setSweep(input);
}

export async function readReslice(): Promise<ResliceView | null> {
  return pies.readReslice();
}

export async function reslicePie(input: Asked<ResliceInput>): Promise<Outcome<PieView>> {
  return pies.reslicePie(input);
}

/** The re-slice page's save: back to the pie once it is re-sliced, where the new cut shows. */
export async function saveReslice(input: Asked<ResliceInput>): Promise<Outcome<PieView>> {
  const outcome = await pies.reslicePie(input);

  if (outcome.ok) redirect("/");

  return outcome;
}

export async function previewReslice(input: Asked<ResliceInput>): Promise<Outcome<ReslicePreview>> {
  return pies.previewReslice(input);
}

export async function weighBite(input: Asked<WeighBiteInput>): Promise<Outcome<WeighingView>> {
  return pies.weighBite(input);
}

export async function takeBite(input: BiteToTake): Promise<Outcome<BiteView>> {
  return pies.takeBite(input);
}

export async function putBackSpread(input: Asked<PutBackSpreadInput>): Promise<Outcome<null>> {
  return pies.putBackSpread(input);
}

export async function putBackBite(input: Asked<PutBackBiteInput>): Promise<Outcome<null>> {
  return pies.putBackBite(input);
}

export async function moveBite(input: Asked<MoveBiteInput>): Promise<Outcome<BiteView>> {
  return pies.moveBite(input);
}

export async function stockStaple(input: Asked<StockStapleInput>): Promise<Outcome<StapleView>> {
  return pies.stockStaple(input);
}

export async function dropStaple(input: Asked<DropStapleInput>): Promise<Outcome<StapleView>> {
  return pies.dropStaple(input);
}

export async function readStatement(upload: StatementUpload): Promise<Outcome<StatementReading>> {
  return pies.readStatement(upload);
}

export async function takeBites(input: Asked<TakeBitesInput>): Promise<Outcome<TakenBites>> {
  return pies.takeBites(input);
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
