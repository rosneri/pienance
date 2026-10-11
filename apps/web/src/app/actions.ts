"use server";

import { ownerOf } from "@pienance/auth";
import type {
  BakePieInput,
  PieView,
  StatementPreview,
  TakeBiteInput,
  TakenBites,
  TakeBitesInput,
  WeighBiteInput,
  WeighingView,
} from "@pienance/core";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, pienance, track } from "@/pienance";
import { accountActions, type Credentials, type SignUpDetails } from "@/server/account-actions";
import type { Outcome } from "@/server/outcome";
import { pieActions, type Asked, type StatementUpload } from "@/server/pie-actions";

// Thin Next.js wrappers: the logic lives in src/server, where it is tested.

const pies = pieActions({
  app: pienance,
  owner: async () => ownerOf(auth(), await headers()),
  refresh: () => revalidatePath("/"),
  track,
});

const accounts = () => accountActions(auth(), headers);

export async function readPie(): Promise<PieView | null> {
  return pies.readPie();
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

export async function readStatement(upload: StatementUpload): Promise<Outcome<StatementPreview>> {
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
