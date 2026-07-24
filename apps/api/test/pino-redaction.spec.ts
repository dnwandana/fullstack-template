import { Controller, Get, Header, INestApplication, Module } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { LoggerModule } from "nestjs-pino"
import request from "supertest"
import { buildPinoHttpOptions } from "../src/config/pino.config"

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
  const prevNodeEnv = process.env.NODE_ENV

  beforeAll(async () => {
    // Force the pino-pretty transport off so lines hit the in-memory stream.
    process.env.NODE_ENV = "production"
    const stream = { write: (line: string) => void lines.push(line) }

    @Module({
      imports: [LoggerModule.forRoot({ pinoHttp: [buildPinoHttpOptions(), stream] })],
      controllers: [PingController],
    })
    class RedactionTestModule {}

    const ref = await Test.createTestingModule({ imports: [RedactionTestModule] }).compile()
    app = ref.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    process.env.NODE_ENV = prevNodeEnv
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
