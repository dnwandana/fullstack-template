import { Test } from "@nestjs/testing"
import { INestApplication } from "@nestjs/common"
import request from "supertest"
import { AppModule } from "../src/app.module"
import { createTestApp } from "./create-test-app"

// The app is built with { bodyParser: false } (see create-test-app.ts): the 413 below
// must come from the explicit 100kb parsers in configureApp. With Nest's hidden default
// parsers active the same 413 arrives from the wrong layer, and editing bootstrap.ts's
// limit would change nothing.
describe("body parser limits (L-22)", () => {
  let app: INestApplication
  beforeAll(async () => {
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = await createTestApp(ref)
  })
  afterAll(async () => app.close())

  it("rejects a JSON body over 100kb with 413", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/signin")
      .set("Content-Type", "application/json")
      .send({ email: "a@b.co", password: "x".repeat(120 * 1024) })
      .expect(413)
  })

  it("accepts a body under the limit", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/signin")
      .send({ email: "nobody@example.com", password: "wrong-password" })
      .expect(401)
  })
})
