import joi from "joi"
import crypto from "node:crypto"
import HttpError from "../utils/http-error.js"
import apiResponse from "../utils/response.js"
import { HTTP_STATUS_CODE, HTTP_STATUS_MESSAGE } from "../utils/constant.js"
import * as roleModel from "../models/roles.js"
import * as permissionModel from "../models/permissions.js"
import db from "../config/database.js"

/** Standard UUID v4 format validation pattern */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Joi schema for validating role creation request bodies.
 * Requires a name and at least one permission ID.
 */
const createRoleSchema = joi
  .object({
    name: joi.string().min(1).max(50).required(),
    description: joi.string().max(5000).optional(),
    permission_ids: joi.array().items(joi.string().uuid()).min(1).required(),
  })
  .options({ stripUnknown: true })

/**
 * Joi schema for validating role update request bodies.
 * All fields are optional — only provided fields are updated.
 */
const updateRoleSchema = joi
  .object({
    name: joi.string().min(1).max(50).optional(),
    description: joi.string().max(5000).optional(),
    permission_ids: joi.array().items(joi.string().uuid()).min(1).optional(),
  })
  .options({ stripUnknown: true })

/**
 * Validates that a role_id route parameter is a well-formed UUID.
 * Throws HttpError if invalid.
 *
 * @param {string} roleId - The role_id value from req.params
 * @returns {string} The validated role ID
 */
const validateRoleIdParam = (roleId) => {
  if (!UUID_REGEX.test(roleId)) {
    throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "Invalid role ID format")
  }
  return roleId
}

/**
 * POST /api/orgs/:org_id/roles — Create a custom role for the organization.
 *
 * Custom roles (is_system = false) allow org admins to define granular permission sets.
 * All provided permission_ids are validated against the permissions table before creation.
 *
 * @param {Object} req - Express request object (req.org.id set by middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const createRole = async (req, res, next) => {
  try {
    const { error, value } = createRoleSchema.validate(req.body)
    if (error) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message)
    }

    const { name, description, permission_ids: permissionIds } = value

    // Verify all provided permission IDs actually exist
    const existingPermissions = await permissionModel.findByIds(permissionIds)
    if (existingPermissions.length !== permissionIds.length) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "One or more permission IDs are invalid")
    }

    const roleId = crypto.randomUUID()

    // Create the role record and assign permissions atomically
    const roleData = {
      id: roleId,
      org_id: req.org.id,
      name,
      is_system: false,
      created_at: new Date(),
      updated_at: new Date(),
    }
    if (description !== undefined) roleData.description = description

    const [role] = await db.transaction(async (trx) => {
      const [created] = await trx("roles")
        .insert(roleData)
        .returning(["id", "org_id", "name", "description", "is_system", "created_at", "updated_at"])

      // Assign permissions within the same transaction
      const rolePerms = permissionIds.map((permissionId) => ({
        role_id: roleId,
        permission_id: permissionId,
      }))
      await trx("role_permissions").insert(rolePerms)

      return [created]
    })

    // Fetch the assigned permissions for the response
    const permissions = await roleModel.findPermissionsByRoleId(roleId)

    return res.status(HTTP_STATUS_CODE.CREATED).json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.CREATED,
        data: { ...role, permissions },
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * GET /api/orgs/:org_id/roles — List all roles for the organization.
 * Includes both system and custom roles, ordered by name.
 *
 * @param {Object} req - Express request object (req.org.id set by middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getRoles = async (req, res, next) => {
  try {
    const roles = await roleModel.findMany({ org_id: req.org.id })

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: roles,
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * GET /api/orgs/:org_id/roles/:role_id — Get a single role with its permissions.
 * Returns the role details along with all assigned permissions.
 *
 * @param {Object} req - Express request object (req.org.id set by middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getRole = async (req, res, next) => {
  try {
    const roleId = validateRoleIdParam(req.params.role_id)

    // Fetch the role, scoped to the current org
    const role = await roleModel.findOne({ id: roleId, org_id: req.org.id })
    if (!role) {
      throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "Role not found")
    }

    // Fetch the permissions assigned to this role
    const permissions = await roleModel.findPermissionsByRoleId(roleId)

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: { ...role, permissions },
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * PUT /api/orgs/:org_id/roles/:role_id — Update a role's name, description, or permissions.
 *
 * Guards:
 * - Cannot rename a system role (system role names are immutable)
 * - Permission IDs (if provided) are validated against the permissions table
 *
 * @param {Object} req - Express request object (req.org.id set by middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const updateRole = async (req, res, next) => {
  try {
    const roleId = validateRoleIdParam(req.params.role_id)

    const { error, value } = updateRoleSchema.validate(req.body)
    if (error) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message)
    }

    // Fetch the existing role, scoped to the current org
    const existingRole = await roleModel.findOne({ id: roleId, org_id: req.org.id })
    if (!existingRole) {
      throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "Role not found")
    }

    const { name, description, permission_ids: permissionIds } = value

    // System roles are immutable — cannot rename or change permissions
    if (existingRole.is_system && name && name !== existingRole.name) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "Cannot rename a system role")
    }
    if (existingRole.is_system && permissionIds) {
      throw new HttpError(
        HTTP_STATUS_CODE.BAD_REQUEST,
        "Cannot modify permissions of a system role",
      )
    }

    // Build update data — only include fields that were provided
    const updateData = { updated_at: new Date() }
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description

    // If permissions are being updated, validate them first
    if (permissionIds) {
      const existingPermissions = await permissionModel.findByIds(permissionIds)
      if (existingPermissions.length !== permissionIds.length) {
        throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "One or more permission IDs are invalid")
      }
    }

    // Update role metadata and permissions atomically
    const [updatedRole] = await db.transaction(async (trx) => {
      const [updated] = await trx("roles")
        .where({ id: roleId })
        .update(updateData)
        .returning(["id", "org_id", "name", "description", "is_system", "created_at", "updated_at"])

      if (permissionIds) {
        // Replace all permissions within the same transaction
        await trx("role_permissions").where("role_id", roleId).delete()
        const rolePerms = permissionIds.map((permissionId) => ({
          role_id: roleId,
          permission_id: permissionId,
        }))
        await trx("role_permissions").insert(rolePerms)
      }

      return [updated]
    })

    // Fetch current permissions for the response
    const permissions = await roleModel.findPermissionsByRoleId(roleId)

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: { ...updatedRole, permissions },
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * DELETE /api/orgs/:org_id/roles/:role_id — Delete a custom role.
 *
 * Guards:
 * - Cannot delete system roles (owner, admin, member, viewer)
 * - Cannot delete a role that is currently assigned to any org or project member
 *
 * @param {Object} req - Express request object (req.org.id set by middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const deleteRole = async (req, res, next) => {
  try {
    const roleId = validateRoleIdParam(req.params.role_id)

    // Fetch the role, scoped to the current org
    const role = await roleModel.findOne({ id: roleId, org_id: req.org.id })
    if (!role) {
      throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "Role not found")
    }

    // System roles cannot be deleted
    if (role.is_system) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "Cannot delete a system role")
    }

    // Check if the role is in use by any org members
    const orgMemberUsingRole = await db
      .select("user_id")
      .from("org_members")
      .where({ role_id: roleId })
      .first()
    if (orgMemberUsingRole) {
      throw new HttpError(
        HTTP_STATUS_CODE.BAD_REQUEST,
        "Cannot delete a role that is currently assigned to members",
      )
    }

    // Check if the role is in use by any project members
    const projectMemberUsingRole = await db
      .select("user_id")
      .from("project_members")
      .where({ role_id: roleId })
      .first()
    if (projectMemberUsingRole) {
      throw new HttpError(
        HTTP_STATUS_CODE.BAD_REQUEST,
        "Cannot delete a role that is currently assigned to members",
      )
    }

    await roleModel.remove({ id: roleId })

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
