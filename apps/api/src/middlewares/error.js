import apiResponse from "../utils/response.js"
import HttpError from "../utils/http-error.js"
import { HTTP_STATUS_CODE, HTTP_STATUS_MESSAGE } from "../utils/constant.js"
import logger from "../utils/logger.js"

/**
 * Express error-handling middleware.
 *
 * Sends a JSON response with the error status code and message using a consistent API response format.
 *
 * @param {Object} err - Express error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with error status and message
 */
export const errorHandler = (err, req, res, _next) => {
  const isHttpError = err instanceof HttpError
  const isProduction = process.env.NODE_ENV === "production"

  // Log error details (stack only outside production)
  const logPayload = {
    requestId: req.id,
    message: err.message,
    status: err.status || HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userId: req.user?.id,
  }
  if (!isProduction) {
    logPayload.stack = err.stack
  }
  logger.error("Error occurred", logPayload)

  let clientMessage = err.message || HTTP_STATUS_MESSAGE.INTERNAL_SERVER_ERROR
  if (isProduction && !isHttpError) {
    clientMessage = HTTP_STATUS_MESSAGE.INTERNAL_SERVER_ERROR
  }

  return res.status(err.status || HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json(
    apiResponse({
      message: clientMessage,
      data: null,
    }),
  )
}

/**
 * Express middleware to handle 404 Not Found errors for unmatched routes.
 *
 * Sends a JSON response with 404 status and a standardized not found message.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with 404 status and not found message
 */
export const notFoundHandler = (req, res, _next) => {
  // Log 404 errors
  logger.warn("Route not found", {
    requestId: req.id,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  })

  return res.status(HTTP_STATUS_CODE.NOT_FOUND).json(
    apiResponse({
      message: HTTP_STATUS_MESSAGE.NOT_FOUND,
      data: null,
    }),
  )
}
