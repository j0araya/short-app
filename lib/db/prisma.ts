import { PrismaClient } from "../../app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const prisma: any =
  globalForPrisma.prisma ??
  // Prisma 7: requires accelerateUrl or adapter — use accelerateUrl with local db URL
  new (PrismaClient as any)();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
