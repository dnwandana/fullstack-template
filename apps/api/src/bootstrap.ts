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

  // Each entry matches an exact route path, not a prefix — "health" alone does NOT
  // cover "health/live". Container healthchecks hit these unprefixed.
  app.setGlobalPrefix(API_PREFIX, { exclude: ["health", "health/live", "health/ready"] })

  // URI versioning: every controller without an explicit @Version lands on v1.
  // This is independent of setGlobalPrefix's `exclude` — a route excluded from the
  // "api" prefix is still versioned unless it is VERSION_NEUTRAL. The health probes
  // are, because nginx and the container healthchecks hardcode their paths.
  //
  // defaultVersion takes the bare "1"; Nest adds the "v". The cookie constants in
  // @core/config/api-version add it explicitly — that asymmetry is why they share
  // API_VERSION rather than a pre-formatted string.
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: API_VERSION })

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
    // extraModels is what makes these classes appear in components.schemas, and every
    // response contract needs an entry here — not just the ones no controller mentions.
    // createDocument emits a schema only for a model it can name in a controller's
    // signature, and handlers return Payload<T>: a generic interface, which erases at
    // compile time. So `Promise<Payload<OrgResponse>>` leaves nothing nameable behind
    // and OrgResponse goes undocumented despite being referenced. Verified by dumping
    // the document with the annotations in place and this array untouched — the schema
    // set was byte-identical to before them.
    //
    // Without an entry the schema is silently absent: the document still generates and
    // every endpoint still works, which is exactly the failure mode this plumbing
    // exists to prevent. Absence is not something the document announces, so a new
    // response class must be added here in the same change that declares it.
    SwaggerModule.setup(
      "api/docs",
      app,
      SwaggerModule.createDocument(app, docs, {
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
        ],
      }),
    )
  }

  app.enableShutdownHooks()
}
