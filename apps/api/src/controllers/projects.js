import joi from "joi"
import crypto from "node:crypto"
import HttpError from "../utils/http-error.js"
import apiResponse from "../utils/response.js"
import { HTTP_STATUS_CODE, HTTP_STATUS_MESSAGE } from "../utils/constant.js"
import * as projectModel from "../models/projects.js"
import * as orgMemberModel from "../models/org-members.js"
import db from "../config/database.js"

/**
 * Joi schema for validating project create/update request bodies.
 * Strips any unknown fields to prevent mass assignment.
 */
const projectBodySchema = joi
  .object({
    name: joi.string().min(1).max(100).required(),
    description: joi.string().max(5000).optional(),
  })
  .options({ stripUnknown: true })

/**
 * POST /api/orgs/:org_id/projects — Create a new project within an organization.
 *
 * Uses a database transaction to atomically:
 * 1. Create the project record
 * 2. Add the creator as a project member using their org-level role
 *
 * Requires project:create permission (checked by middleware).
 *
 * @param {Object} req - Express request object (req.org.id, req.user.id set by middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const createProject = async (req, res, next) => {
  try {
    const { error, value } = projectBodySchema.validate(req.body)
    if (error) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message)
    }

    const userId = req.user.id
    const orgId = req.org.id
    const { name, description } = value
    const projectId = crypto.randomUUID()

    // Look up the creator's org role so they get the same role in the project
    const orgMembership = await orgMemberModel.findOne({
      user_id: userId,
      org_id: orgId,
    })

    // Transaction: create project + add creator as project member
    const [project] = await db.transaction(async (trx) => {
      const projectData = {
        id: projectId,
        org_id: orgId,
        name,
        created_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
      }
      if (description !== undefined) projectData.description = description

      const [createdProject] = await trx("projects")
        .insert(projectData)
        .returning([
          "id",
          "org_id",
          "name",
          "description",
          "created_by",
          "created_at",
          "updated_at",
        ])

      // Add the creator as a project member with their org-level role
      await trx("project_members").insert({
        user_id: userId,
        project_id: projectId,
        role_id: orgMembership.role_id,
      })

      return [createdProject]
    })

    return res.status(HTTP_STATUS_CODE.CREATED).json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.CREATED,
        data: project,
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * GET /api/orgs/:org_id/projects — List all projects in the organization.
 *
 * The permission middleware already gates access via project:read,
 * so all org projects are returned regardless of project-level membership.
 *
 * @param {Object} req - Express request object (req.org.id set by middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getProjects = async (req, res, next) => {
  try {
    const projects = await projectModel.findManyByOrgId(req.org.id)

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: projects,
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * GET /api/orgs/:org_id/projects/:project_id — Get a single project's details.
 * Requires resolveProject middleware to have run (sets req.project).
 *
 * @param {Object} req - Express request object (req.project.id set by middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getProject = async (req, res, next) => {
  try {
    const project = await projectModel.findOne({ id: req.project.id })

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: project,
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * PUT /api/orgs/:org_id/projects/:project_id — Update a project's name and/or description.
 * Requires project:update permission.
 *
 * @param {Object} req - Express request object (req.project.id set by middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const updateProject = async (req, res, next) => {
  try {
    const { error, value } = projectBodySchema.validate(req.body)
    if (error) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message)
    }

    const { name, description } = value
    const updateData = { name, updated_at: new Date() }
    if (description !== undefined) updateData.description = description

    const [project] = await projectModel.update({ id: req.project.id }, updateData)
    if (!project) {
      throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "Project not found")
    }

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: project,
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * DELETE /api/orgs/:org_id/projects/:project_id — Delete a project.
 * Requires project:delete permission.
 * CASCADE removes all related records (todos, project_members).
 *
 * @param {Object} req - Express request object (req.project.id set by middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const deleteProject = async (req, res, next) => {
  try {
    await projectModel.remove({ id: req.project.id })

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
