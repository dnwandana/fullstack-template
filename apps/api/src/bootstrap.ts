import { INestApplication } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
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

  app.enableShutdownHooks()
}
