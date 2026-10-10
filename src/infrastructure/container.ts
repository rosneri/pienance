import { bakePie, servePie, takeBite, weighBite } from "@/application";
import type { PieRepository } from "@/domain";
import { InMemoryPieRepository } from "./in-memory-pie-repository";
import { PrismaPieRepository } from "./prisma/prisma-pie-repository";
import { prisma } from "./prisma/client";

/**
 * Composition root: wires use cases to their adapters.
 * Without DATABASE_URL the app runs in memory, handy for a quick look.
 */
function pieRepository(): PieRepository {
  if (process.env.DATABASE_URL) return new PrismaPieRepository(prisma());
  // Kept global so every server bundle (pages, actions) shares the same memory.
  const memory = globalThis as unknown as { pies?: InMemoryPieRepository };
  memory.pies ??= new InMemoryPieRepository();
  return memory.pies;
}

const pies = pieRepository();

export const pienance = {
  bakePie: bakePie(pies),
  servePie: servePie(pies),
  weighBite: weighBite(pies),
  takeBite: takeBite(pies),
};
