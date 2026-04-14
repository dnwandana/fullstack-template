import joi from "joi"
import crypto from "node:crypto"
import HttpError from "../utils/http-error.js"
import apiResponse from "../utils/response.js"
import { HTTP_STATUS_CODE, HTTP_STATUS_MESSAGE } from "../utils/constant.js"
import * as organizationModel from "../models/organizations.js"
import db from "../config/database.js"

/**
 * The four system roles created for every new organization.
 * Each role has a predefined set of permissions that cannot be modified.
 */
const SYSTEM_ROLES = ["owner", "admin", "member", "viewer"]

/**
 * Joi schema for validating organization create/update request bodies.
 * Strips any unknown fields to prevent mass assignment.
 */
const orgBodySchema = joi
  .object({
    name: joi.string().min(1).max(100).required(),
    description: joi.string().max(5000).optional(),
  })
  .options({ stripUnknown: true })

/**
 * Creates the four system roles (owner, admin, member, viewer) for a new organization
 * and assigns the appropriate permissions to each role.
 *
 * Permission mapping:
 * - owner: all permissions
 * - admin: all except org:delete and org:manage_roles
 * - member: org:read, project:read, todos CRUD
 * - viewer: org:read, project:read, todos:read
 *
 * @param {import("knex").Knex.Transaction} trx - Knex transaction instance
 * @param {string} orgId - UUID of the newly created organization
 * @param {Object[]} allPermissions - Array of { id, name } from the permissions table
 * @returns {Promise<string>} The UUID of the owner role (used to assign the creator)
 */
const createSystemRoles = async (trx, orgId, allPermissions) => {
  // Build a name -> id lookup for quick permission resolution
  const permissionMap = {}
  for (const p of allPermissions) {
    permissionMap[p.name] = p.id
  }

  // Define which permissions each system role receives
  const allPermIds = Object.values(permissionMap)
  const adminPermIds = allPermIds.filter(
    (id) => id !== permissionMap["org:delete"] && id !== permissionMap["org:manage_roles"],
  )
  const memberPermIds = [
    permissionMap["org:read"],
    permissionMap["project:read"],
    permissionMap["todos:create"],
    permissionMap["todos:read"],
    permissionMap["todos:update"],
    permissionMap["todos:delete"],
  ]
  const viewerPermIds = [
    permissionMap["org:read"],
    permissionMap["project:read"],
    permissionMap["todos:read"],
  ]

  const rolePermMap = {
    owner: allPermIds,
    admin: adminPermIds,
    member: memberPermIds,
    viewer: viewerPermIds,
  }
  let ownerRoleId

  for (const name of SYSTEM_ROLES) {
    const roleId = crypto.randomUUID()
    if (name === "owner") ownerRoleId = roleId

    // Insert the role record
    await trx("roles").insert({
      id: roleId,
      org_id: orgId,
      name,
      description: `System ${name} role`,
      is_system: true,
      created_at: new Date(),
      updated_at: new Date(),
    })

    // Assign permissions to the role via the junction table
    const rolePerms = rolePermMap[name].map((permissionId) => ({
      role_id: roleId,
      permission_id: permissionId,
    }))
    if (rolePerms.length > 0) {
      await trx("role_permissions").insert(rolePerms)
    }
  }

  return ownerRoleId
}

/**
 * POST /api/orgs — Create a new organization.
 *
 * Uses a database transaction to atomically:
 * 1. Create the organization record
 * 2. Create the four system roles with their permissions
 * 3. Add the creator as the owner of the organization
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const createOrg = async (req, res, next) => {
  try {
    const { error, value } = orgBodySchema.validate(req.body)
    if (error) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message)
    }

    const userId = req.user.id
    const { name, description } = value
    const orgId = crypto.randomUUID()

    // Fetch all permissions upfront — needed to build role-permission mappings
    const allPermissions = await db.select("id", "name").from("permissions")

    // Transaction: create org + system roles + add creator as owner
    const [org] = await db.transaction(async (trx) => {
      const [createdOrg] = await trx("organizations")
        .insert({
          id: orgId,
          name,
          description,
          created_by: userId,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning(["id", "name", "description", "created_by", "created_at", "updated_at"])

      const ownerRoleId = await createSystemRoles(trx, orgId, allPermissions)

      // Add the creator as the owner member
      await trx("org_members").insert({
        user_id: userId,
        org_id: orgId,
        role_id: ownerRoleId,
      })

      return [createdOrg]
    })

    return res.status(HTTP_STATUS_CODE.CREATED).json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.CREATED,
        data: org,
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * GET /api/orgs — List all organizations the authenticated user belongs to.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getOrgs = async (req, res, next) => {
  try {
    const orgs = await organizationModel.findManyByUserId(req.user.id)

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: orgs,
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * GET /api/orgs/:org_id — Get a single organization's details.
 * Requires resolveOrg middleware to have run (sets req.org).
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getOrg = async (req, res, next) => {
  try {
    const org = await organizationModel.findOne({ id: req.org.id })

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: org,
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * PUT /api/orgs/:org_id — Update an organization's name and/or description.
 * Requires org:update permission.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const updateOrg = async (req, res, next) => {
  try {
    const { error, value } = orgBodySchema.validate(req.body)
    if (error) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message)
    }

    const { name, description } = value
    const updateData = { name, updated_at: new Date() }
    if (description !== undefined) updateData.description = description

    const [org] = await organizationModel.update({ id: req.org.id }, updateData)
    if (!org) {
      throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "Organization not found")
    }

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: org,
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * DELETE /api/orgs/:org_id — Delete an organization.
 * Requires org:delete permission (owner only).
 * CASCADE removes all related records (projects, todos, members, invitations).
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const deleteOrg = async (req, res, next) => {
  try {
    await organizationModel.remove({ id: req.org.id })

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
