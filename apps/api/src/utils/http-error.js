import { HTTP_STATUS_CODE, HTTP_STATUS_MESSAGE } from "./constant.js"

/**
 * Custom HTTP error class.
 *
 * Extends the built-in Error class to include a status code.
 */
class HttpError extends Error {
  /**
   * HTTP status code.
   */
  status

  /**
   * Creates a new HttpError instance.
   *
   * @param {number} status - HTTP status code
   * @param {string} message - Error message
   */
  constructor(status = HTTP_STATUS_CODE.BAD_REQUEST, message = HTTP_STATUS_MESSAGE.BAD_REQUEST) {
    super(message)
    this.status = status

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }

    this.name = this.constructor.name
  }
}

export default HttpError
