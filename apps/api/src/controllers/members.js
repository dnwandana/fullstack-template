import joi from "joi"
import HttpError from "../utils/http-error.js"
import apiResponse from "../utils/response.js"
import { HTTP_STATUS_CODE, HTTP_STATUS_MESSAGE } from "../utils/constant.js"
import * as orgMemberModel from "../models/org-members.js"
import * as projectMemberModel from "../models/project-members.js"
import * as roleModel from "../models/roles.js"

/** Standard UUID v4 format validation pattern */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Joi schema for validating role update request bodies.
 * Requires a valid UUID for the target role.
 */
const roleSchema = joi
  .object({
    role_id: joi.string().uuid().required(),
  })
  .options({ stripUnknown: true })

/**
 * Determines whether the request is in a project context or org-only context.
 * Project context is present when resolveProject middleware has run (sets req.project).
 *
 * @param {Object} req - Express request object
 * @returns {boolean} True if operating in project context
 */
const isProjectContext = (req) => Boolean(req.project)

/**
 * GET /api/orgs/:org_id/members — List org members.
 * GET /api/orgs/:org_id/projects/:project_id/members — List project members.
 *
 * Automatically detects context from req.project presence:
 * - If req.project exists: returns project members via projectMemberModel
 * - Otherwise: returns org members via orgMemberModel
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getMembers = async (req, res, next) => {
  try {
    let members

    if (isProjectContext(req)) {
      // Project-level: list members of this specific project
      members = await projectMemberModel.findManyByProjectId(req.project.id)
    } else {
      // Org-level: list all members of the organization
      members = await orgMemberModel.findManyByOrgId(req.org.id)
    }

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: members,
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * PUT /api/orgs/:org_id/members/:user_id — Update an org member's role.
 * PUT /api/orgs/:org_id/projects/:project_id/members/:user_id — Update a project member's role.
 *
 * Guards:
 * - Cannot change your own role
 * - Cannot demote the last owner of the org (prevents orphaned orgs)
 * - Target role must belong to the same organization
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const updateMemberRole = async (req, res, next) => {
  try {
    // Validate the :user_id route parameter
    const targetUserId = req.params.user_id
    if (!UUID_REGEX.test(targetUserId)) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "Invalid user ID format")
    }

    // Validate the request body
    const { error, value } = roleSchema.validate(req.body)
    if (error) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message)
    }

    const { role_id: roleId } = value

    // Prevent users from changing their own role
    if (targetUserId === req.user.id) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "You cannot change your own role")
    }

    // Verify the target role exists and belongs to this organization
    const role = await roleModel.findOne({ id: roleId, org_id: req.org.id })
    if (!role) {
      throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "Role not found in this organization")
    }

    if (isProjectContext(req)) {
      // --- Project-level role update ---
      const membership = await projectMemberModel.findOne({
        user_id: targetUserId,
        project_id: req.project.id,
      })
      if (!membership) {
        throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "User is not a member of this project")
      }

      await projectMemberModel.updateRole(
        { user_id: targetUserId, project_id: req.project.id },
        roleId,
      )
    } else {
      // --- Org-level role update ---
      const membership = await orgMemberModel.findOne({
        user_id: targetUserId,
        org_id: req.org.id,
      })
      if (!membership) {
        throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "User is not a member of this organization")
      }

      // If the target member is currently an owner, check that at least one other owner remains
      const currentRole = await roleModel.findOne({ id: membership.role_id })
      if (currentRole && currentRole.name === "owner") {
        const orgMembers = await orgMemberModel.findManyByOrgId(req.org.id)
        const ownerCount = orgMembers.filter((m) => m.role_name === "owner").length
        if (ownerCount <= 1) {
          throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "Cannot change role of the last owner")
        }
      }

      await orgMemberModel.updateRole({ user_id: targetUserId, org_id: req.org.id }, roleId)
    }

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: null,
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * DELETE /api/orgs/:org_id/members/:user_id — Remove an org member.
 * DELETE /api/orgs/:org_id/projects/:project_id/members/:user_id — Remove a project member.
 *
 * Guards:
 * - Cannot remove yourself (use a "leave" endpoint instead)
 * - Cannot remove the last owner of the org (prevents orphaned orgs)
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const removeMember = async (req, res, next) => {
  try {
    // Validate the :user_id route parameter
    const targetUserId = req.params.user_id
    if (!UUID_REGEX.test(targetUserId)) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "Invalid user ID format")
    }

    // Prevent users from removing themselves
    if (targetUserId === req.user.id) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "You cannot remove yourself")
    }

    if (isProjectContext(req)) {
      // --- Project-level removal ---
      const membership = await projectMemberModel.findOne({
        user_id: targetUserId,
        project_id: req.project.id,
      })
      if (!membership) {
        throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "User is not a member of this project")
      }

      await projectMemberModel.remove({
        user_id: targetUserId,
        project_id: req.project.id,
      })
    } else {
      // --- Org-level removal ---
      const membership = await orgMemberModel.findOne({
        user_id: targetUserId,
        org_id: req.org.id,
      })
      if (!membership) {
        throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "User is not a member of this organization")
      }

      // If the target member is an owner, ensure at least one other owner remains
      const currentRole = await roleModel.findOne({ id: membership.role_id })
      if (currentRole && currentRole.name === "owner") {
        const orgMembers = await orgMemberModel.findManyByOrgId(req.org.id)
        const ownerCount = orgMembers.filter((m) => m.role_name === "owner").length
        if (ownerCount <= 1) {
          throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "Cannot remove the last owner")
        }
      }

      await orgMemberModel.remove({ user_id: targetUserId, org_id: req.org.id })
    }

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: null,
      }),
    )
  } catch (error) {
    return next(error)
  }
}
