import { Injectable } from "@nestjs/common"
import { randomUUID } from "crypto"
import { PrismaService } from "@core/database/prisma.service"

const SAFE_SELECT = { id: true, name: true, email: true } as const

/**
 * User lookups shared across modules. The `findSafe*` methods project id/name/email only, never
 * the password hash; `findWithPasswordByEmail` is the single method that returns it.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Persists a new user. `password` must already be hashed — this does no hashing. */
  create(input: { name: string; email: string; password: string }) {
    return this.prisma.user.create({
      data: { id: randomUUID(), name: input.name, email: input.email, password: input.password },
      select: SAFE_SELECT,
    })
  }

  findSafeById(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: SAFE_SELECT })
  }

  findSafeByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email }, select: SAFE_SELECT })
  }

  /** Signin projection: includes the password hash and lockout state — never return it raw. */
  findWithPasswordByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        failedLoginAttempts: true,
        lockedUntil: true,
      },
    })
  }

  /** Increments the failed-login counter and returns its new value. Throws P2025 if id is gone. */
  async incrementFailedAttempts(id: string): Promise<number> {
    const updated = await this.prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    })
    return updated.failedLoginAttempts
  }

  /** Locks the account until `until` and resets the failed-attempt counter to 0. */
  async lockAccount(id: string, until: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: 0, lockedUntil: until },
    })
  }

  /** Clears both the failed-attempt counter and any active lock, after a successful signin. */
  async resetLockout(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    })
  }
}
