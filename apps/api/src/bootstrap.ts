import { INestApplication, VersioningType } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import { Logger } from "nestjs-pino"
import helmet from "helmet"
import cookieParser from "cookie-parser"
import { json, urlencoded } from "express"
import { API_PREFIX, API_VERSION } from "@core/config/api-version"
import { PaginationMetaResponse } from "@shared/dto/pagination-meta.response"
import { TodoListResponse, TodoResponse } from "@modules/todos/dto/todo.response"
import { OrgResponse } from "@modules/orgs/dto/org.response"
import { ProjectResponse } from "@modules/projects/dto/project.response"
import { PermissionResponse, RoleResponse } from "@modules/roles/dto/role.response"
import {
  InvitationListItemResponse,
  InvitationListResponse,
  InvitationPreviewResponse,
  InvitationResponse,
  InvitationWithTokenResponse,
  MyInvitationResponse,
} from "@modules/invitations/dto/invitation.response"
import { AuditLogResponse } from "@modules/audit-logs/dto/audit-log.response"

/**
 * Applies every global HTTP concern to an already-created Nest app, in place.
 * Callers must create the app with `bodyParser: false` — the 100kb json/urlencoded parsers
 * registered here have to be the only ones, or that limit is dead configuration.
 */
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

  // Origins via ConfigService: Joi's default is the single source of truth, a literal diverges.
  // `methods` is a whitelist — a PATCH route is rejected at preflight even if a controller defines
  // it. X-Request-Id is exposed so SPA JS can read the correlation id back into a bug report.
  app.enableCors({
    origin: config
      .getOrThrow<string>("CORS_ALLOWED_ORIGINS")
      .split(",")
      .map((s) => s.trim()),
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id"],
    credentials: true,
  })

  app.use(json({ limit: "100kb" }))
  app.use(urlencoded({ extended: true, limit: "100kb" }))
  app.use(cookieParser())

  // Each entry is an exact route path, not a prefix — "health" alone does NOT cover "health/live".
  // nginx and the container healthchecks hardcode these unprefixed paths.
  app.setGlobalPrefix(API_PREFIX, { exclude: ["health", "health/live", "health/ready"] })

  // `exclude` above does not exempt a route from the version segment — the health controller opts
  // out separately with VERSION_NEUTRAL. defaultVersion is bare "1"; Nest prepends the "v", the
  // cookie constants in @core/config/api-version do not — which is why both share API_VERSION.
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: API_VERSION })

  // Via ConfigService, never process.env: @nestjs/config never writes Joi's NODE_ENV-derived
  // default back there, so a production deploy with SWAGGER_ENABLED unset would publish the whole
  // spec. The === "true" test is fail-closed, so an unexpected undefined also stays off.
  if (config.get<string>("SWAGGER_ENABLED") === "true") {
    const docs = new DocumentBuilder()
      .setTitle("Fullstack Template API")
      .setDescription("Multi-tenant API with org/project scoping and RBAC")
      .setVersion("1.0")
      // This API authenticates with the access_token httpOnly cookie, not a bearer header.
      .addCookieAuth("access_token")
      .build()
    // Mounted after setGlobalPrefix so the documented paths carry the /api/v1 prefix clients call.
    SwaggerModule.setup(
      "api/docs",
      app,
      SwaggerModule.createDocument(app, docs, {
        // A response class reaches components.schemas only if listed here — handlers return
        // Payload<T>, a generic interface that erases at compile time, so the scanner has nothing
        // to name. Omission is silent: the document generates fine, so add every new class here.
        extraModels: [
          PaginationMetaResponse,
          TodoResponse,
          TodoListResponse,
          OrgResponse,
          ProjectResponse,
          RoleResponse,
          PermissionResponse,
          InvitationResponse,
          InvitationWithTokenResponse,
          InvitationListItemResponse,
          InvitationListResponse,
          MyInvitationResponse,
          InvitationPreviewResponse,
          AuditLogResponse,
        ],
      }),
    )
  }

  app.enableShutdownHooks()
}
