import joi from "joi"
import HttpError from "../utils/http-error.js"
import apiResponse from "../utils/response.js"
import { HTTP_STATUS_CODE, HTTP_STATUS_MESSAGE } from "../utils/constant.js"
import * as todoModel from "../models/todos.js"
import crypto from "node:crypto"
import { validatePaginationQuery, executePaginatedQuery } from "../utils/pagination.js"

/**
 * Joi schema for validating the :todo_id route parameter.
 */
const todoIdParamSchema = joi
  .object({
    todo_id: joi.string().uuid().required(),
  })
  .options({ allowUnknown: true })

/**
 * Joi schema for validating todo create/update request bodies.
 * Strips unknown fields to prevent mass assignment.
 */
const todoBodySchema = joi
  .object({
    title: joi.string().max(255).required(),
    description: joi.string().max(5000).optional(),
    is_completed: joi.boolean().optional(),
  })
  .options({ stripUnknown: true })

/**
 * Joi schema for validating the bulk delete query string.
 * Accepts up to 50 comma-separated UUIDs.
 */
const deleteTodosQuerySchema = joi
  .object({
    ids: joi
      .string()
      .required()
      .custom((value, helpers) => {
        const ids = value.split(",").map((id) => id.trim())
        if (ids.length > 50) {
          return helpers.error("any.invalid")
        }
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        for (const id of ids) {
          if (!uuidRegex.test(id)) {
            return helpers.error("any.invalid")
          }
        }
        return ids
      })
      .messages({ "any.invalid": "ids must be 1-50 comma-separated valid UUIDs" }),
  })
  .options({ stripUnknown: true })

/**
 * Express middleware to validate the :todo_id route parameter.
 * Stores the validated UUID on req.todoId for downstream handlers.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const requireTodoIdParam = (req, res, next) => {
  const { error, value } = todoIdParamSchema.validate(req.params)
  if (error) {
    throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message)
  }

  // Store validated todo ID on the request
  const { todo_id } = value
  req.todoId = todo_id

  next()
}

/**
 * GET /api/orgs/:org_id/projects/:project_id/todos — List todos with pagination.
 * Scoped to the project via req.project.id (set by resolveProject middleware).
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getTodos = async (req, res, next) => {
  try {
    // Validate pagination/search/sort query parameters
    const params = validatePaginationQuery(req.query, ["updated_at", "title"])

    // Fetch count + todos in parallel, scoped to the project
    const { data: todos, pagination } = await executePaginatedQuery(
      todoModel.count,
      todoModel.findManyPaginated,
      { project_id: req.project.id },
      params,
      ["title"],
    )

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: todos,
        pagination,
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * GET /api/orgs/:org_id/projects/:project_id/todos/:todo_id — Get a single todo.
 * Scoped to the project via req.project.id.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getTodo = async (req, res, next) => {
  try {
    const todoId = req.todoId

    // Find the todo scoped to the current project
    const todo = await todoModel.findOne({ id: todoId, project_id: req.project.id })
    if (!todo) {
      throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "Todo not found")
    }

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: todo,
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * POST /api/orgs/:org_id/projects/:project_id/todos — Create a new todo.
 * Scoped to the project via req.project.id. The authenticated user is recorded as the creator.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const createTodo = async (req, res, next) => {
  try {
    const { error, value } = todoBodySchema.validate(req.body)
    if (error) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message)
    }

    const { title, description, is_completed } = value

    // Build the todo record — project_id for scoping, user_id as creator
    const todoData = {
      id: crypto.randomUUID(),
      project_id: req.project.id,
      user_id: req.user.id,
      title,
      created_at: new Date(),
      updated_at: new Date(),
    }
    if (description !== undefined) todoData.description = description
    if (is_completed !== undefined) todoData.is_completed = is_completed

    const [todo] = await todoModel.create(todoData)

    return res.status(HTTP_STATUS_CODE.CREATED).json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.CREATED,
        data: todo,
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * PUT /api/orgs/:org_id/projects/:project_id/todos/:todo_id — Update a todo.
 * Scoped to the project via req.project.id.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const updateTodo = async (req, res, next) => {
  try {
    const { error, value } = todoBodySchema.validate(req.body)
    if (error) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message)
    }

    const todoId = req.todoId
    const { title, description, is_completed } = value

    // Build update data — only include optional fields if provided
    const updateData = { title, updated_at: new Date() }
    if (description !== undefined) updateData.description = description
    if (is_completed !== undefined) updateData.is_completed = is_completed

    const [todo] = await todoModel.update({ id: todoId, project_id: req.project.id }, updateData)
    if (!todo) {
      throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "Todo not found")
    }

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: todo,
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * DELETE /api/orgs/:org_id/projects/:project_id/todos/:todo_id — Delete a single todo.
 * Scoped to the project via req.project.id.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const deleteTodo = async (req, res, next) => {
  try {
    const todoId = req.todoId

    // Delete the todo scoped to the current project
    await todoModel.remove({ id: todoId, project_id: req.project.id })

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
 * DELETE /api/orgs/:org_id/projects/:project_id/todos?ids=id1,id2,... — Bulk delete todos.
 * Accepts up to 50 comma-separated UUIDs in the query string.
 * Scoped to the project via req.project.id.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const deleteTodos = async (req, res, next) => {
  try {
    const { error, value } = deleteTodosQuerySchema.validate(req.query)
    if (error) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message)
    }

    const todoIds = value.ids

    // Bulk delete scoped to the current project
    await todoModel.removeMany(todoIds, { project_id: req.project.id })

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
