import HttpError from "../utils/http-error.js"
import { HTTP_STATUS_CODE } from "../utils/constant.js"
import * as projectModel from "../models/projects.js"
import * as projectMemberModel from "../models/project-members.js"

// Standard UUID v4 format validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Express middleware that resolves a project from the :project_id route parameter.
 *
 * Requires `req.org` to be set by the resolveOrg middleware (must run after it).
 *
 * Performs the following:
 * 1. Validates that project_id is a well-formed UUID
 * 2. Verifies the project exists and belongs to the current organization
 * 3. Loads project-level permissions if the user is a project member
 * 4. Merges project permissions with existing org-level permissions (deduplicates via Set)
 * 5. If the user is not a project member, org permissions serve as fallback (no change)
 *
 * On success, sets:
 * - `req.project` — `{ id }` of the resolved project
 * - `req.permissions` — updated permission array (org + project, deduplicated)
 *
 * @param {Object} req - Express request object (must have req.user.id and req.org.id)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const resolveProject = async (req, res, next) => {
  try {
    const { project_id: projectId } = req.params

    // Validate UUID format before hitting the database
    if (!projectId || !UUID_REGEX.test(projectId)) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "Invalid project ID format")
    }

    // Verify the project exists and belongs to the resolved organization
    const project = await projectModel.findOne({ id: projectId, org_id: req.org.id })
    if (!project) {
      throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "Project not found")
    }

    // Load project-level permissions for this user
    const projectPermissionRows = await projectMemberModel.getPermissions(req.user.id, projectId)

    if (projectPermissionRows.length > 0) {
      // Merge project permissions with existing org permissions, deduplicating via Set
      const projectPermissionNames = projectPermissionRows.map((row) => row.name)
      const merged = new Set([...req.permissions, ...projectPermissionNames])
      req.permissions = [...merged]
    }
    // If no project membership, org-level permissions (already on req.permissions) remain as fallback

    // Attach project context for downstream middleware/controllers
    req.project = { id: project.id }

    next()
  } catch (error) {
    return next(error)
  }
}
