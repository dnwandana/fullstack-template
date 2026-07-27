import { randomUUID } from "crypto"
import { ConfigService } from "@nestjs/config"
import type { Options } from "pino-http"

// Two shapes accepted: a dashed UUID (what this app mints) and nginx's 32 undashed hex chars
// ($request_id, forwarded as X-Request-Id by nginx/templates/api.conf.template). Alternation
// rather than optional dashes: "-?" would accept half-dashed junk, and the id is logged verbatim.
const REQUEST_ID_RE =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32})$/i

/**
 * Extracted from AppModule so tests can build a logger from the exact same options and assert
 * that no auth-token material reaches the log stream.
 */
export function buildPinoHttpOptions(config: ConfigService): Options {
  return {
    level: config.getOrThrow<string>("LOG_LEVEL"),
    redact: {
      paths: ["req.headers.cookie", "req.headers.authorization", 'res.headers["set-cookie"]'],
      remove: true,
    },
    genReqId: (req, res) => {
      const incoming = req.headers["x-request-id"]
      const valid = typeof incoming === "string" && REQUEST_ID_RE.test(incoming)
      const id = valid ? incoming : randomUUID()
      res.setHeader("x-request-id", id)
      return id
    },
    transport:
      config.getOrThrow<string>("NODE_ENV") !== "production"
        ? { target: "pino-pretty", options: { singleLine: true } }
        : undefined,
  }
}
