import { INestApplication } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import { Logger } from "nestjs-pino"
import helmet from "helmet"
import cookieParser from "cookie-parser"
import { json, urlencoded } from "express"

export function configureApp(app: INestApplication): void {
  app.useLogger(app.get(Logger))

  const http = app.getHttpAdapter().getInstance()
  http.set("trust proxy", 1)

  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"] } },
      referrerPolicy: { policy: "no-referrer" },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    }),
  )

  const config = app.get(ConfigService)

  app.enableCors({
    // Through ConfigService, not process.env: the Joi default is the single source of
    // truth for the fallback. A literal `?? "http://localhost:8080"` here duplicates it,
    // and the two silently diverge the day someone edits one of them.
    origin: config
      .getOrThrow<string>("CORS_ALLOWED_ORIGINS")
      .split(",")
      .map((s) => s.trim()),
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "X-Request-Id"],
    // Browser JS cannot read a response header that is not exposed, so without this a
    // SPA has no way to surface the correlation id in a bug report.
    exposedHeaders: ["X-Request-Id"],
    credentials: true,
  })

  app.use(json({ limit: "100kb" }))
  app.use(urlencoded({ extended: true, limit: "100kb" }))
  app.use(cookieParser())

  app.setGlobalPrefix("api", { exclude: ["health"] })

  // Read through ConfigService, never process.env. Joi's NODE_ENV-derived default is applied
  // to the validated config object that backs ConfigService, and @nestjs/config does not
  // write defaults for absent keys back into process.env — so a production deploy with
  // SWAGGER_ENABLED unset would evaluate `undefined !== "false"` and publish the whole spec.
  // The comparison is fail-closed (=== "true") so an unexpected undefined also stays off.
  // configureApp runs after NestFactory.create, so the container is available here.
  if (config.get<string>("SWAGGER_ENABLED") === "true") {
    const docs = new DocumentBuilder()
      .setTitle("Fullstack Template API")
      .setDescription("Multi-tenant API with org/project scoping and RBAC")
      .setVersion("1.0")
      // This API authenticates with the access_token httpOnly cookie, not a bearer header.
      .addCookieAuth("access_token")
      .build()
    // Mounted after setGlobalPrefix so the documented paths carry the /api prefix the
    // client actually calls.
    SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, docs))
  }

  app.enableShutdownHooks()
}
