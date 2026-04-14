import HttpError from "../utils/http-error.js"
import { HTTP_STATUS_CODE } from "../utils/constant.js"
import * as organizationModel from "../models/organizations.js"
import * as orgMemberModel from "../models/org-members.js"

// Standard UUID v4 format validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Express middleware that resolves an organization from the :org_id route parameter.
 *
 * Performs three checks in sequence:
 * 1. Validates that org_id is a well-formed UUID
 * 2. Verifies the organization exists in the database
 * 3. Confirms the authenticated user is a member and loads their permissions
 *
 * On success, sets:
 * - `req.org` — `{ id }` of the resolved organization
 * - `req.permissions` — flat array of permission name strings for the user in this org
 *
 * @param {Object} req - Express request object (must have req.user.id from auth middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const resolveOrg = async (req, res, next) => {
  try {
    const { org_id: orgId } = req.params

    // Validate UUID format before hitting the database
    if (!orgId || !UUID_REGEX.test(orgId)) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "Invalid organization ID format")
    }

    // Verify the organization exists
    const org = await organizationModel.findOne({ id: orgId })
    if (!org) {
      throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "Organization not found")
    }

    // Verify the authenticated user is a member of this organization
    const membership = await orgMemberModel.findMemberWithPermissions(req.user.id, orgId)
    if (!membership) {
      throw new HttpError(HTTP_STATUS_CODE.FORBIDDEN, "You are not a member of this organization")
    }

    // Load the user's permission names within this organization
    const permissionRows = await orgMemberModel.getPermissions(req.user.id, orgId)
    const permissionNames = permissionRows.map((row) => row.name)

    // Attach org context and permissions to the request for downstream middleware/controllers
    req.org = { id: org.id }
    req.permissions = permissionNames

    next()
  } catch (error) {
    return next(error)
  }
}
