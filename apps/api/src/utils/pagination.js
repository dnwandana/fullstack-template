import joi from "joi"
import HttpError from "./http-error.js"
import { HTTP_STATUS_CODE } from "./constant.js"
import { escapeIlike } from "./sanitize.js"

/**
 * Validates pagination query parameters against a Joi schema.
 *
 * @param {Object} query - Express request query object (req.query)
 * @param {string[]} sortableColumns - Valid column names for sorting (first element is the default)
 * @returns {{ page: number, limit: number, sort_by: string, sort_order: string, search: string }} Validated params
 */
export const validatePaginationQuery = (query, sortableColumns) => {
  const schema = joi.object({
    page: joi.number().integer().min(1).default(1),
    limit: joi.number().integer().min(1).max(100).default(10),
    sort_by: joi
      .string()
      .valid(...sortableColumns)
      .default(sortableColumns[0]),
    sort_order: joi.string().valid("asc", "desc").default("desc"),
    search: joi.string().trim().max(255).default(""),
  })

  const { error, value } = schema.validate(query)
  if (error) {
    throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message)
  }

  return value
}

/**
 * Builds pagination metadata from query results.
 *
 * @param {number} page - Current page number (1-indexed)
 * @param {number} limit - Items per page
 * @param {number} totalItems - Total number of items
 * @returns {Object} Pagination metadata
 */
export const buildPaginationMeta = (page, limit, totalItems) => {
  const totalPages = Math.ceil(totalItems / limit)
  const hasNextPage = page < totalPages
  const hasPreviousPage = page > 1

  let nextPage = null
  if (hasNextPage) {
    nextPage = page + 1
  }

  let previousPage = null
  if (hasPreviousPage) {
    previousPage = page - 1
  }

  return {
    current_page: page,
    total_pages: totalPages,
    total_items: totalItems,
    items_per_page: limit,
    has_next_page: hasNextPage,
    has_previous_page: hasPreviousPage,
    next_page: nextPage,
    previous_page: previousPage,
  }
}

/**
 * Executes a paginated query by fetching count and data in parallel.
 *
 * @param {Function} countFn - Function that accepts (conditions, options) and returns { count }
 * @param {Function} findFn - Function that accepts (conditions, options) and returns rows
 * @param {Object} conditions - WHERE conditions passed to both functions
 * @param {{ page: number, limit: number, sort_by: string, sort_order: string, search: string }} params - Pagination params
 * @param {string[]} [searchableColumns=[]] - Columns to apply search against (ILIKE)
 * @returns {Promise<{ data: Array, pagination: Object }>} Paginated result
 */
export const executePaginatedQuery = async (
  countFn,
  findFn,
  conditions,
  params,
  searchableColumns = [],
) => {
  const { page, limit, sort_by, sort_order, search } = params
  const offset = (page - 1) * limit

  let sanitizedSearch = ""
  if (search) {
    sanitizedSearch = escapeIlike(search)
  }

  let searchOptions = {}
  if (sanitizedSearch && searchableColumns.length) {
    searchOptions = { search: sanitizedSearch, searchColumns: searchableColumns }
  }

  const [countResult, data] = await Promise.all([
    countFn(conditions, searchOptions),
    findFn(conditions, {
      limit,
      offset,
      orders: [{ column: sort_by, order: sort_order }],
      ...searchOptions,
    }),
  ])

  const totalItems = parseInt(countResult.count)
  const pagination = buildPaginationMeta(page, limit, totalItems)

  return { data, pagination }
}
