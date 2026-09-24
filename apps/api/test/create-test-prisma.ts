// Relative imports, not aliases: test/setup-e2e.ts loads this file, and Jest's globalSetup does
// not apply moduleNameMapper.
import { PrismaClient } from "../src/generated/prisma/client"
import { createPrismaAdapter } from "../src/core/database/prisma-adapter"

/** Returns a PrismaClient outside the Nest container, for the global setup and the seed suite. */
export function createTestPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("Test setup failed: DATABASE_URL is not set. Check apps/api/.env.test.")
  return new PrismaClient({ adapter: createPrismaAdapter(url) })
}
