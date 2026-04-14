import crypto from "node:crypto"

const REQUEST_ID_HEADER = "x-request-id"
const MAX_REQUEST_ID_LENGTH = 128

/**
 * Express middleware that ensures every request has a unique correlation ID.
 *
 * Uses the incoming `X-Request-Id` header when present (up to 128 chars);
 * otherwise generates a new UUID v4 via `crypto.randomUUID()`. The resolved
 * ID is stored on `req.id` and echoed back in the `X-Request-Id` response header.
 *
 * @param {import("express").Request} req - Express request object
 * @param {import("express").Response} res - Express response object
 * @param {import("express").NextFunction} next - Express next middleware function
 */
export const requestId = (req, res, next) => {
  const incoming = req.headers[REQUEST_ID_HEADER]
  let id = crypto.randomUUID()
  if (incoming && incoming.length <= MAX_REQUEST_ID_LENGTH) {
    id = incoming
  }
  req.id = id
  res.setHeader(REQUEST_ID_HEADER, id)
  next()
}
