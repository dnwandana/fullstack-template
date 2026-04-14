import express from "express"
import cors from "cors"
import helmet from "helmet"
import hpp from "hpp"
import routes from "./routes/index.js"
import healthRoutes from "./routes/health.js"
import { errorHandler, notFoundHandler } from "./middlewares/error.js"
import { generalLimiter } from "./middlewares/rate-limit.js"
import { httpLogger, requestLogger } from "./middlewares/logger.js"
import { requestId } from "./middlewares/request-id.js"

const app = express()
app.set("trust proxy", 1)

// request ID — must be first so all downstream middleware can use req.id
app.use(requestId)

// security
app.use(
  helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"] } },
    referrerPolicy: { policy: "no-referrer" },
  }),
)
app.use(
  cors({
    origin: process.env.CORS_ALLOWED_ORIGINS?.split(",").map((s) => s.trim()) || [
      "http://localhost:8080",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "x-access-token", "x-refresh-token"],
  }),
)

// body parsing
app.use(express.json({ limit: "100kb" }))
app.use(express.urlencoded({ extended: true, limit: "100kb" }))
app.use(hpp())

// health check — before rate limiting so load balancers aren't throttled
app.use("/health", healthRoutes)

// rate limiting
app.use(generalLimiter)

// logging
app.use(httpLogger)
app.use(requestLogger)

// routes
app.use("/api", routes)

// not found and error handler
app.use(notFoundHandler)
app.use(errorHandler)

export default app
