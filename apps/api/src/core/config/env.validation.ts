import { z } from "zod"

// Replaces Zod's "expected string, received undefined" with a message an operator can act on.
const required = {
  error: (issue: { input?: unknown }) => (issue.input === undefined ? "is required" : undefined),
}

// Grammar is deliberately narrower than what @nestjs/jwt accepts (no "1w"): the same value drives
// the JWT, the refresh_tokens row, and the cookie maxAge via parseDuration.
const duration = (example: string) =>
  z
    .string()
    .regex(/^\d+[smhd]$/, `must be <number><s|m|h|d>, e.g. ${example}`)
    .default(example)

const secret = z.string(required).min(32)

const envSchema = z
  .looseObject({
    DATABASE_URL: z.url({ ...required, protocol: /^postgres(ql)?$/ }),
    ACCESS_TOKEN_SECRET: secret,
    REFRESH_TOKEN_SECRET: secret,
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    ACCESS_TOKEN_EXPIRES_IN: duration("15m"),
    REFRESH_TOKEN_EXPIRES_IN: duration("7d"),
    LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
    CLEANUP_ENABLED: z.enum(["true", "false"]).default("true"),
    CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:8080"),
    APP_BASE_URL: z.url().default("http://localhost:8080"),
    RATE_LIMIT_AUTH_MAX: z.coerce.number().int().min(1).max(50).default(10),
    RATE_LIMIT_GENERAL_MAX: z.coerce.number().int().min(1).default(1000),
    JWT_ISSUER: z.string(required),
    JWT_AUDIENCE: z.string(required),
    // Required with no default, in every environment. BullMQ has no in-memory driver, so an
    // optional Redis with a fallback would mean the queue accepts jobs nothing ever runs — mail
    // silently never sends while /health/ready reports healthy. Missing Redis must stop the boot.
    REDIS_URL: z.url({ ...required, protocol: /^rediss?$/ }),
    // Audit rows older than this many days are removed by the nightly cleanup job.
    AUDIT_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
    // The default depends on NODE_ENV, so the transform below sets it.
    SWAGGER_ENABLED: z.enum(["true", "false"]).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.ACCESS_TOKEN_SECRET === env.REFRESH_TOKEN_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["REFRESH_TOKEN_SECRET"],
        message: "must be different from ACCESS_TOKEN_SECRET",
      })
    }
    for (const key of ["ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"] as const) {
      if (/^changeme/i.test(env[key])) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "contains a placeholder value. Generate a random secret.",
        })
      }
    }
  })
  // Off in production by default: publishing a fresh deployment's full route and schema surface
  // should be deliberate.
  .transform((env) => ({
    ...env,
    SWAGGER_ENABLED: env.SWAGGER_ENABLED ?? (env.NODE_ENV === "production" ? "false" : "true"),
  }))

/**
 * ConfigModule's validate hook: applies the defaults above and throws before the app boots,
 * reporting every offending variable at once. An empty variable (`PORT=`) counts as unset, so it
 * gets its default or fails as required.
 */
export function validate(config: Record<string, unknown>): Record<string, unknown> {
  const input = Object.fromEntries(Object.entries(config).filter(([, value]) => value !== ""))
  const result = envSchema.safeParse(input)
  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `  - ${issue.path.join(".")}: ${issue.message}`,
    )
    throw new Error(`Environment validation failed:\n${lines.join("\n")}`)
  }
  return result.data
}
