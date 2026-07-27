import { Injectable, OnModuleInit } from "@nestjs/common"
import * as argon2 from "argon2"

/** Argon2 hashing, plus the dummy hash signin verifies against on the unknown-email path. */
@Injectable()
export class PasswordService implements OnModuleInit {
  /**
   * Verified against when no user matched, so signin's latency does not reveal whether the email
   * exists. Built in `onModuleInit`, so it is undefined until the module initialises — a test
   * that only calls `compile()` never gets one.
   */
  dummyHash!: string

  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.hash("dummy-timing-safe-password")
  }

  hash(plain: string): Promise<string> {
    return argon2.hash(plain)
  }

  verify(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain)
  }
}
