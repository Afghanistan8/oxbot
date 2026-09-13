import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 *
 * In development, Next.js hot-reload would otherwise create a new client on
 * every reload and exhaust the database connection pool, so we cache it on the
 * global object.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Optional cap on this process's connection pool (PRISMA_CONNECTION_LIMIT).
 * Hosted poolers in session mode allow few clients (Supabase: 15) shared by
 * every deployment and local dev server, so a small cap keeps one process
 * from starving the rest. Unset → Prisma's default pool sizing.
 */
function datasourceUrl(): string | undefined {
  const limit = process.env.PRISMA_CONNECTION_LIMIT;
  const url = process.env.DATABASE_URL;
  if (!limit || !url) return undefined;
  try {
    const u = new URL(url);
    u.searchParams.set("connection_limit", limit);
    return u.toString();
  } catch {
    return undefined;
  }
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: datasourceUrl(),
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
