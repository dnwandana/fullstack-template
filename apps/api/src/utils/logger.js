import winston from "winston"
import DailyRotateFile from "winston-daily-rotate-file"
import path from "path"

// Define log formats
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
)

// Console log format
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`
    }
    return msg
  }),
)

// Use structured JSON in production, colorized output in development
let consoleTransportFormat = consoleFormat
if (process.env.NODE_ENV === "production") {
  consoleTransportFormat = logFormat
}

// Define transports
const transports = [
  new winston.transports.Console({
    format: consoleTransportFormat,
  }),
]

// Add file transports when LOG_TO_FILE is enabled
if (process.env.LOG_TO_FILE === "true") {
  const logDir = path.join(process.cwd(), "logs")

  const createRotateTransport = (filename, level) => {
    return new DailyRotateFile({
      filename: path.join(logDir, filename),
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d",
      level,
    })
  }

  transports.push(createRotateTransport("error-%DATE%.log", "error"))
  transports.push(createRotateTransport("combined-%DATE%.log", "info"))
}

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL,
  format: logFormat,
  transports,
  exitOnError: false,
})

// Create a stream object for Morgan HTTP logger
logger.stream = {
  write: (message) => {
    logger.info(message.trim())
  },
}

export default logger
