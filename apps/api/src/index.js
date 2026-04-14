import "dotenv/config"
import validateEnv from "./utils/validate-env.js"

// validate environment variables before anything else
validateEnv()

// import app after env validation so all process.env values are set
const { default: app } = await import("./app.js")
const { default: logger } = await import("./utils/logger.js")
const { default: db } = await import("./config/database.js")

const PORT = process.env.PORT

// start server
const server = app.listen(PORT, () => {
  logger.info(`Server started successfully`, {
    port: PORT,
    environment: process.env.NODE_ENV,
  })
})

// graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}, starting graceful shutdown`)
  server.close(async () => {
    logger.info("HTTP server closed")
    try {
      await db.destroy()
      logger.info("Database connections closed")
      process.exit(0)
    } catch (err) {
      logger.error("Error closing database connections", { error: err.message })
      process.exit(1)
    }
  })
  setTimeout(() => {
    logger.error("Forced shutdown after timeout")
    process.exit(1)
  }, 10000)
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
process.on("SIGINT", () => gracefulShutdown("SIGINT"))
