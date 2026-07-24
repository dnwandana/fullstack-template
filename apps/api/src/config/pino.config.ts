import { randomUUID } from "crypto"
import type { Options } from "pino-http"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Extracted from AppModule so tests can build a logger from the exact same
// options and assert that no auth-token material reaches the log stream.
export function buildPinoHttpOptions(): Options {
  return {
    level: process.env.LOG_LEVEL ?? "info",
    redact: {
      paths: ["req.headers.cookie", "req.headers.authorization", 'res.headers["set-cookie"]'],
      remove: true,
    },
    genReqId: (req, res) => {
      const incoming = req.headers["x-request-id"]
      const valid = typeof incoming === "string" && UUID_RE.test(incoming)
      const id = valid ? incoming : randomUUID()
      res.setHeader("x-request-id", id)
      return id
    },
    transport:
      process.env.NODE_ENV !== "production"
        ? { target: "pino-pretty", options: { singleLine: true } }
        : undefined,
  }
}
