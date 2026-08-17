import * as Joi from "joi"

const schema = Joi.object({
  DATABASE_URL: Joi.string()
    .uri({ scheme: ["postgresql", "postgres"] })
    .required(),
  ACCESS_TOKEN_SECRET: Joi.string().min(32).required(),
  REFRESH_TOKEN_SECRET: Joi.string().min(32).required(),
  NODE_ENV: Joi.string().valid("development", "production", "test").default("development"),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  // Grammar is deliberately narrower than what @nestjs/jwt accepts (no "1w"): the same
  // value drives the JWT, the refresh_tokens row, and the cookie maxAge via parseDuration.
  ACCESS_TOKEN_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default("15m")
    // {{#label}} keeps the offending key name in the message — without it Joi's custom
    // message replaces the whole default and the operator cannot tell which var is wrong.
    .messages({ "string.pattern.base": "{{#label}} must be <number><s|m|h|d>, e.g. 15m" }),
  REFRESH_TOKEN_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default("7d")
    .messages({ "string.pattern.base": "{{#label}} must be <number><s|m|h|d>, e.g. 7d" }),
  LOG_LEVEL: Joi.string().valid("error", "warn", "info", "debug").default("info"),
  CLEANUP_ENABLED: Joi.string().valid("true", "false").default("true"),
  CORS_ALLOWED_ORIGINS: Joi.string().default("http://localhost:8080"),
  APP_BASE_URL: Joi.string().uri().default("http://localhost:8080"),
  RATE_LIMIT_AUTH_MAX: Joi.number().integer().min(1).max(50).default(10),
  RATE_LIMIT_GENERAL_MAX: Joi.number().integer().min(1).default(1000),
  JWT_ISSUER: Joi.string().required(),
  JWT_AUDIENCE: Joi.string().required(),
  // Required with no default, in every environment. BullMQ has no in-memory driver, so an
  // optional Redis with a fallback would mean the queue accepts jobs nothing ever runs — mail
  // silently never sends while /health/ready reports healthy. Missing Redis must stop the boot.
  REDIS_URL: Joi.string()
    .uri({ scheme: ["redis", "rediss"] })
    .required(),
  // Audit rows older than this many days are removed by the nightly cleanup job.
  AUDIT_RETENTION_DAYS: Joi.number().integer().positive().default(90),
  // Off in production by default: publishing a fresh deployment's full route and schema surface
  // should be deliberate. Keep this declared LAST — Joi resolves keys in declaration order and
  // reads siblings off `parent`, so NODE_ENV must already carry its default when this runs.
  SWAGGER_ENABLED: Joi.string()
    .valid("true", "false")
    .default((parent) => (parent.NODE_ENV === "production" ? "false" : "true")),
}).unknown(true)

/**
 * ConfigModule's validate hook: applies the defaults above and throws before the app boots,
 * reporting every offending variable at once. Also rejects JWT secrets that are equal to each
 * other or start with `changeme`, neither of which Joi can express here.
 */
export function validate(config: Record<string, unknown>): Record<string, unknown> {
  const { error, value } = schema.validate(config, { abortEarly: false, convert: true })
  if (error) {
    throw new Error(
      `Environment validation failed:\n${error.details.map((d) => `  - ${d.message}`).join("\n")}`,
    )
  }
  if (value.ACCESS_TOKEN_SECRET === value.REFRESH_TOKEN_SECRET) {
    throw new Error(
      "Environment validation failed:\n  - ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be different",
    )
  }
  for (const key of ["ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"] as const) {
    if (/^changeme/i.test(String(value[key]))) {
      throw new Error(
        `Environment validation failed:\n  - ${key} contains a placeholder value. Generate a random secret.`,
      )
    }
  }
  return value
}
