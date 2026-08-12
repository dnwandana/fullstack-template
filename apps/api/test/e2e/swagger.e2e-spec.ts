import { Test } from "@nestjs/testing"
import { INestApplication } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import request from "supertest"
import { AppModule } from "../../src/app.module"
import { createTestApp } from "../create-test-app"
import { validate } from "@core/config/env.validation"

// SwaggerModule registers its routes straight on the Express instance, so these responses
// bypass TransformInterceptor entirely — the document is the whole body, not body.data.
//
// The CLI plugin that infers @ApiProperty from class-validator decorators is configured in
// nest-cli.json, which only governs `nest build`. test/jest-e2e.json runs it under ts-jest
// too, via test/swagger-plugin.transformer.js — without that shim every DTO schema below
// would be `{ type: "object", properties: {} }` and the schema assertions would be vacuous.

const base = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  ACCESS_TOKEN_SECRET: "a".repeat(40),
  REFRESH_TOKEN_SECRET: "b".repeat(40),
  JWT_ISSUER: "https://api.example.com",
  JWT_AUDIENCE: "https://api.example.com",
  REDIS_URL: "redis://localhost:6379",
}

describe("SWAGGER_ENABLED validation", () => {
  it("defaults to false in production so an unset var never publishes the spec", () => {
    expect(validate({ ...base, NODE_ENV: "production" }).SWAGGER_ENABLED).toBe("false")
  })

  it("defaults to true outside production", () => {
    expect(validate({ ...base, NODE_ENV: "development" }).SWAGGER_ENABLED).toBe("true")
    expect(validate({ ...base, NODE_ENV: "test" }).SWAGGER_ENABLED).toBe("true")
  })

  it("honours an explicit opt-in in production", () => {
    const out = validate({ ...base, NODE_ENV: "production", SWAGGER_ENABLED: "true" })
    expect(out.SWAGGER_ENABLED).toBe("true")
  })

  it("rejects a value that is neither true nor false", () => {
    expect(() => validate({ ...base, SWAGGER_ENABLED: "yes" })).toThrow(/SWAGGER_ENABLED/)
  })
})

describe("GET /api/docs (enabled)", () => {
  let app: INestApplication
  beforeAll(async () => {
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = await createTestApp(ref)
  })
  afterAll(async () => app.close())

  it("serves the generated document", async () => {
    const res = await request(app.getHttpServer()).get("/api/docs-json")
    expect(res.status).toBe(200)
    expect(res.body.info.title).toBe("Fullstack Template API")
    expect(res.body.info.version).toBe("1.0")
    expect(res.body.paths["/api/v1/auth/signup"]).toBeDefined()
  })

  it("serves the Swagger UI", async () => {
    const res = await request(app.getHttpServer()).get("/api/docs")
    expect(res.status).toBe(200)
    expect(res.headers["content-type"]).toMatch(/text\/html/)
    expect(res.text).toContain("swagger-ui")
  })

  it("documents the invitation accept body restored in Task 05", async () => {
    const res = await request(app.getHttpServer()).get("/api/docs-json")
    const op = res.body.paths["/api/v1/invitations/{invitation_id}/accept"].post
    expect(op.requestBody.required).toBe(true)
    // Derived from the controller's @Body() param type. If a handler ever drops its body
    // again — the M-1 regression — requestBody disappears and this throws.
    expect(op.requestBody.content["application/json"].schema.$ref).toBe(
      "#/components/schemas/AcceptInvitationDto",
    )
    // Follow the $ref: a schema that exists but is empty would satisfy the assertion above
    // while documenting nothing.
    expect(res.body.components.schemas.AcceptInvitationDto.required).toContain("token")
  })

  it("infers DTO constraints from class-validator decorators", async () => {
    const res = await request(app.getHttpServer()).get("/api/docs-json")
    const { properties, required } = res.body.components.schemas.SignupDto
    // These come from @MinLength(8)/@MaxLength(128)/@IsEmail on SignupDto — nothing in src/
    // writes @ApiProperty by hand, so an empty properties object here means the plugin
    // stopped running and every schema in the published spec is silently blank.
    expect(properties.password.minLength).toBe(8)
    expect(properties.password.maxLength).toBe(128)
    expect(properties.email.format).toBe("email")
    expect(required).toEqual(
      expect.arrayContaining(["name", "email", "password", "confirmation_password"]),
    )
  })

  it("documents cookie auth, not bearer auth", async () => {
    const res = await request(app.getHttpServer()).get("/api/docs-json")
    expect(res.body.components.securitySchemes).toEqual({
      cookie: { type: "apiKey", in: "cookie", name: "access_token" },
    })
  })

  it("carries the /api prefix because setup runs after setGlobalPrefix", async () => {
    const res = await request(app.getHttpServer()).get("/api/docs-json")
    const paths = Object.keys(res.body.paths)
    expect(paths).toContain("/api/v1/permissions")
    expect(paths).not.toContain("/permissions")
  })

  it("documents the prefix-excluded health routes unprefixed", async () => {
    const res = await request(app.getHttpServer()).get("/api/docs-json")
    expect(res.body.paths["/health/live"]).toBeDefined()
    expect(res.body.paths["/health/ready"]).toBeDefined()
    expect(res.body.paths["/api/v1/health/live"]).toBeUndefined()
  })

  it("emits a schema for the pagination envelope", async () => {
    // PaginationMeta is an interface and erases at compile time — only a decorated
    // class produces a schema. Without this, every paginated endpoint documents its
    // `pagination` field as an empty object.
    const res = await request(app.getHttpServer()).get("/api/docs-json")
    expect(res.body.components?.schemas).toHaveProperty("PaginationMetaResponse")
  })

  it("documents the password-reset routes added in Task 06", async () => {
    const res = await request(app.getHttpServer()).get("/api/docs-json")
    expect(res.body.paths["/api/v1/auth/forgot-password"]).toBeDefined()
    expect(res.body.paths["/api/v1/auth/reset-password"]).toBeDefined()
  })
})

describe("GET /api/docs (disabled)", () => {
  let app: INestApplication
  beforeAll(async () => {
    // Mutating process.env here would do nothing: ConfigModule.forRoot() runs `validate`
    // EAGERLY, inside forRoot itself, which already happened when this file imported
    // app.module.ts. Recompiling AppModule reuses that cached DynamicModule and its
    // config — validated back when SWAGGER_ENABLED was unset, so it holds "true".
    // jest.resetModules() would re-run forRoot but also re-instantiates @nestjs/schedule
    // against a cached @nestjs/core, splitting Reflector's class identity and breaking DI.
    // Overriding the provider changes the one value under test and nothing else.
    const disabled = validate({ ...process.env, SWAGGER_ENABLED: "false" })
    const ref = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      // Delegates to the real Joi-validated config (so numeric coercion and every other
      // default survive) with only SWAGGER_ENABLED forced off. getOrThrow must mirror the
      // real service's contract — configureApp uses it for CORS_ALLOWED_ORIGINS.
      .useValue({
        get: (key: string) => disabled[key],
        getOrThrow: (key: string) => {
          if (disabled[key] === undefined) throw new Error(`Missing config key "${key}"`)
          return disabled[key]
        },
      })
      .compile()
    app = await createTestApp(ref)
  })
  afterAll(async () => app.close())

  it("mounts nothing when SWAGGER_ENABLED is false", async () => {
    // SwaggerModule.setup registers straight on the Express instance, ahead of Nest's
    // router. With the gate closed nothing is registered, so the request falls through to
    // Nest's catch-all NotFoundException and comes back as the standard error envelope —
    // which is what distinguishes "not mounted" from "mounted and returning 404".
    for (const path of ["/api/docs-json", "/api/docs"]) {
      const res = await request(app.getHttpServer()).get(path)
      expect(res.status).toBe(404)
      expect(res.body).toEqual({
        message: expect.stringContaining("Cannot GET"),
        data: null,
        request_id: expect.any(String),
      })
    }
  })
})
