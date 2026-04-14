import { HTTP_STATUS_MESSAGE } from "./constant.js"

/**
 * Sends a standardized JSON response.
 *
 * @param {Object} options - The options for the response.
 * @param {string} [options.message="OK"] A human-readable message describing the result.
 * @param {*} [options.data=null] The payload to include in the response body.
 * @param {Object} [options.pagination] Pagination metadata for list endpoints.
 */
export default ({ message = HTTP_STATUS_MESSAGE.OK, data = null, pagination }) => {
  const response = { message, data }

  if (pagination !== undefined) {
    response.pagination = pagination
  }

  return response
}
