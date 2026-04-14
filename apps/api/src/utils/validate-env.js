import joi from "joi"

// Joi schema for validating application environment variables.
const envSchema = joi.object({
  DATABASE_URL: joi
    .string()
    .uri({ scheme: ["postgresql", "postgres"] })
    .required(),
  ACCESS_TOKEN_SECRET: joi.string().min(32).required(),
  REFRESH_TOKEN_SECRET: joi.string().min(32).required(),
  NODE_ENV: joi.string().valid("development", "production", "test").default("development"),
  PORT: joi.number().integer().min(1).max(65535).default(3000),
  ACCESS_TOKEN_EXPIRES_IN: joi.string().default("15m"),
  REFRESH_TOKEN_EXPIRES_IN: joi.string().default("7d"),
  LOG_LEVEL: joi.string().valid("error", "warn", "info", "debug").default("info"),
  LOG_TO_FILE: joi.string().valid("true", "false").default("true"),
  CORS_ALLOWED_ORIGINS: joi.string().default("http://localhost:8080"),
  RATE_LIMIT_AUTH_MAX: joi.number().integer().min(1).default(10),
  RATE_LIMIT_GENERAL_MAX: joi.number().integer().min(1).default(100),
  JWT_ISSUER: joi.string().required(),
  JWT_AUDIENCE: joi.string().required(),
})

// Only extract app-specific keys from process.env before validating.
// This avoids needing .unknown(true) for system env vars (PATH, HOME, etc.).
const appEnvKeys = [
  "DATABASE_URL",
  "ACCESS_TOKEN_SECRET",
  "REFRESH_TOKEN_SECRET",
  "NODE_ENV",
  "PORT",
  "ACCESS_TOKEN_EXPIRES_IN",
  "REFRESH_TOKEN_EXPIRES_IN",
  "LOG_LEVEL",
  "LOG_TO_FILE",
  "CORS_ALLOWED_ORIGINS",
  "RATE_LIMIT_AUTH_MAX",
  "RATE_LIMIT_GENERAL_MAX",
  "JWT_ISSUER",
  "JWT_AUDIENCE",
]

/**
 * Validates required environment variables at startup.
 *
 * Must be called before Express initializes — uses console.error + process.exit(1)
 * instead of HttpError because the Express error handler doesn't exist yet.
 * Uses abortEarly: false to report all validation errors at once.
 */
const validateEnv = () => {
  const appEnv = {}
  for (const key of appEnvKeys) {
    if (process.env[key] !== undefined) {
      appEnv[key] = process.env[key]
    }
  }

  const { error, value } = envSchema.validate(appEnv, { abortEarly: false })

  if (error) {
    const details = error.details.map((d) => `  - ${d.message}`).join("\n")
    console.error(`Environment validation failed:\n${details}`)
    process.exit(1)
  }

  // Write validated values (with Joi defaults applied) back to process.env
  // so the rest of the app can use process.env directly without fallbacks.
  for (const [key, val] of Object.entries(value)) {
    process.env[key] = String(val)
  }
}

export default validateEnv
