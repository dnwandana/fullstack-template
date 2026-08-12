import { Test } from "@nestjs/testing"
import { JwtModule } from "@nestjs/jwt"
import { ConfigModule } from "@nestjs/config"
import { TokenService } from "../token.service"

describe("TokenService", () => {
  let tokens: TokenService
  beforeAll(async () => {
    const ref = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        JwtModule.register({}),
      ],
      providers: [TokenService],
    }).compile()
    tokens = ref.get(TokenService)
  })

  it("signs and verifies an access token with type=access", async () => {
    const t = await tokens.signAccess("user-1")
    const decoded = await tokens.verifyAccess(t)
    expect(decoded.id).toBe("user-1")
    expect(decoded.type).toBe("access")
  })

  it("signs a refresh token with a jti and type=refresh", async () => {
    const t = await tokens.signRefresh("user-2")
    const decoded = await tokens.verifyRefresh(t)
    expect(decoded.id).toBe("user-2")
    expect(decoded.type).toBe("refresh")
    expect(typeof decoded.jti).toBe("string")
  })

  it("rejects an access token verified as refresh (different secret)", async () => {
    const access = await tokens.signAccess("u")
    await expect(tokens.verifyRefresh(access)).rejects.toBeDefined()
  })
})
