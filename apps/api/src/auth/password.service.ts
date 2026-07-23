import { Injectable, OnModuleInit } from "@nestjs/common"
import * as argon2 from "argon2"

@Injectable()
export class PasswordService implements OnModuleInit {
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
