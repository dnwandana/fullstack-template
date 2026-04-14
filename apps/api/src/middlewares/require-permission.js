import HttpError from "../utils/http-error.js"
import { HTTP_STATUS_CODE } from "../utils/constant.js"

/**
 * Higher-order middleware factory that checks whether the authenticated user
 * has a specific permission.
 *
 * Must be used after resolveOrg (and optionally resolveProject), which populate
 * `req.permissions` with the user's permission name strings.
 *
 * @param {string} permission - The permission name to check (e.g., "todos:create")
 * @returns {Function} Express middleware that calls next() if permitted, or passes
 *   a 403 HttpError to next(error) if not
 *
 * @example
 * router.post("/todos", requirePermission("todos:create"), todosController.create)
 */
export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.permissions || !req.permissions.includes(permission)) {
      return next(
        new HttpError(
          HTTP_STATUS_CODE.FORBIDDEN,
          "You do not have permission to perform this action",
        ),
      )
    }
    next()
  }
}
