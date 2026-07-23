import { Injectable } from "@nestjs/common"
import { randomUUID } from "crypto"
import { PrismaService } from "../prisma/prisma.service"

const SAFE_SELECT = { id: true, name: true, email: true } as const

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

  async incrementFailedAttempts(id: string): Promise<number> {
    const updated = await this.prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    })
    return updated.failedLoginAttempts
  }

  async lockAccount(id: string, until: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: 0, lockedUntil: until },
    })
  }

  async resetLockout(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    })
  }
}
