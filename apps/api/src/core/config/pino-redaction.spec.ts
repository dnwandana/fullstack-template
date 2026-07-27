import { Controller, Get, Header, INestApplication, Module } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Test } from "@nestjs/testing"
import { LoggerModule } from "nestjs-pino"
import request from "supertest"
import { buildPinoHttpOptions } from "./pino.config"

const SECRET = "eyJTOPSECRET"

@Controller()
class PingController {
  @Get("ping")
  @Header("Set-Cookie", `access_token=${SECRET}.fromres; HttpOnly`)
  ping() {
    return { ok: true }
  }
}

describe("pino redaction (H-1)", () => {
  let app: INestApplication
  const lines: string[] = []

  beforeAll(async () => {
    // NODE_ENV "production" forces the pino-pretty transport off so lines hit the
    // in-memory stream. Stubbed ConfigService, mirroring test/swagger.e2e-spec.ts.
    const config = {
      getOrThrow: (k: string) => ({ LOG_LEVEL: "info", NODE_ENV: "production" })[k],
    } as unknown as ConfigService
    const stream = { write: (line: string) => void lines.push(line) }

    @Module({
      imports: [LoggerModule.forRoot({ pinoHttp: [buildPinoHttpOptions(config), stream] })],
      controllers: [PingController],
    })
    class RedactionTestModule {}

    const ref = await Test.createTestingModule({ imports: [RedactionTestModule] }).compile()
    app = ref.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it("omits cookie, authorization and set-cookie headers from request logs", async () => {
    await request(app.getHttpServer())
      .get("/ping")
      .set("Cookie", `access_token=${SECRET}.access; refresh_token=${SECRET}.refresh`)
      .set("Authorization", `Bearer ${SECRET}.bearer`)
      .expect(200)

    const line = lines.find((l) => l.includes('"req"'))
    expect(line).toBeDefined()
    expect(line).not.toContain(SECRET)
    const parsed = JSON.parse(line as string)
    expect(parsed.req.headers.cookie).toBeUndefined()
    expect(parsed.req.headers.authorization).toBeUndefined()
    expect(parsed.res.headers["set-cookie"]).toBeUndefined()
  })
})
