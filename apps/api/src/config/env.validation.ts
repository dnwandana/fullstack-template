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
  // Off in production by default, on everywhere else. Publishing the full route and schema
  // surface of a fresh deployment should be a deliberate act. Joi evaluates function
  // defaults with sibling values on `parent`, and keys resolve in declaration order — so
  // NODE_ENV already carries its own default by the time this runs. Keep it declared last.
  SWAGGER_ENABLED: Joi.string()
    .valid("true", "false")
    .default((parent) => (parent.NODE_ENV === "production" ? "false" : "true")),
}).unknown(true)

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
