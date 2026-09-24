import { PrismaPg } from "@prisma/adapter-pg"

/**
 * Returns the PostgreSQL driver adapter for every PrismaClient in the app, the seed and the tests.
 * Prisma 7 connects through `pg`, whose pool waits forever for a connection by default. The
 * 5-second limit keeps the fail-fast boot of the Prisma 6 engine.
 */
export const createPrismaAdapter = (connectionString: string): PrismaPg =>
  new PrismaPg({ connectionString, connectionTimeoutMillis: 5_000 })
