import { INestApplication } from "@nestjs/common"
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

  app.enableCors({
    origin: (process.env.CORS_ALLOWED_ORIGINS ?? "http://localhost:8080")
      .split(",")
      .map((s) => s.trim()),
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  })

  app.use(json({ limit: "100kb" }))
  app.use(urlencoded({ extended: true, limit: "100kb" }))
  app.use(cookieParser())

  app.setGlobalPrefix("api", { exclude: ["health"] })

  app.enableShutdownHooks()
}
