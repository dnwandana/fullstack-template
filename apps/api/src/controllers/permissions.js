import apiResponse from "../utils/response.js"
import { HTTP_STATUS_MESSAGE } from "../utils/constant.js"
import * as permissionModel from "../models/permissions.js"

/**
 * GET /api/permissions — List all available system permissions.
 *
 * Returns the full set of permissions for reference when creating custom roles.
 * Permissions are system-defined and seeded — they cannot be created or modified via API.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getPermissions = async (req, res, next) => {
  try {
    const permissions = await permissionModel.findAll()

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: permissions,
      }),
    )
  } catch (error) {
    return next(error)
  }
}
