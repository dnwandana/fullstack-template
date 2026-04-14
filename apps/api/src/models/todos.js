import db from "../config/database.js"

const TABLE_NAME = "todos"
const TODO_COLUMNS = [
  "id",
  "project_id",
  "user_id",
  "title",
  "description",
  "is_completed",
  "created_at",
  "updated_at",
]
const SORTABLE_COLUMNS = ["created_at", "updated_at", "title", "is_completed"]

// Filter out any sort columns that are not in the allowed list to prevent SQL injection
const filterSortableColumns = (orders) => {
  if (!orders) return null
  return orders.filter((order) => SORTABLE_COLUMNS.includes(order.column))
}

/**
 * Insert a new todo into the database.
 *
 * @param {Object} todo - Todo data to insert
 * @param {string} todo.user_id - UUID of the user creating the todo
 * @param {string} todo.title - Todo title
 * @param {string} [todo.description] - Todo description
 * @returns {Promise<Object[]>} Array containing the newly created todo
 */
export const create = (todo) => {
  return db.insert(todo).into(TABLE_NAME).returning(TODO_COLUMNS)
}

/**
 * Find a single todo matching the given conditions.
 *
 * @param {Object} conditions - Key-value pairs to match against (e.g., { id, user_id })
 * @returns {Promise<Object|undefined>} The matched todo or undefined
 */
export const findOne = (conditions) => {
  return db.select(TODO_COLUMNS).from(TABLE_NAME).where(conditions).first()
}

/**
 * Find all todos matching the given conditions with optional ordering.
 *
 * @param {Object} conditions - Key-value pairs to filter by
 * @param {Object[]|null} [orders=null] - Array of { column, order } sort directives
 * @returns {Promise<Object[]>} Array of matched todos
 */
export const findMany = (conditions, orders = null) => {
  let query = db.select(TODO_COLUMNS).from(TABLE_NAME).where(conditions)
  const validOrders = filterSortableColumns(orders)
  if (validOrders?.length > 0) {
    query = query.orderBy(validOrders)
  }
  return query
}

/**
 * Find todos with pagination, search, and sorting support.
 * Used by the pagination utility for list endpoints.
 *
 * @param {Object} conditions - Key-value pairs to filter by
 * @param {Object} [options={}] - Pagination and search options
 * @param {number} [options.limit=10] - Maximum number of results
 * @param {number} [options.offset=0] - Number of results to skip
 * @param {Object[]|null} [options.orders=null] - Sort directives
 * @param {string} [options.search=""] - Search term for ILIKE matching
 * @param {string[]} [options.searchColumns=[]] - Columns to search within
 * @returns {Promise<Object[]>} Paginated array of todos
 */
export const findManyPaginated = (conditions, options = {}) => {
  // default options
  const { limit = 10, offset = 0, orders = null, search = "", searchColumns = [] } = options

  let query = db.select(TODO_COLUMNS).from(TABLE_NAME).where(conditions)

  if (search && searchColumns.length) {
    query = query.where(function () {
      for (const col of searchColumns) {
        this.orWhere(col, "ilike", `%${search}%`)
      }
    })
  }

  const validOrders = filterSortableColumns(orders)
  if (validOrders?.length > 0) {
    query = query.orderBy(validOrders)
  }

  return query.limit(limit).offset(offset)
}

/**
 * Count todos matching the given conditions, with optional search filtering.
 * Used alongside findManyPaginated to build pagination metadata.
 *
 * @param {Object} conditions - Key-value pairs to filter by
 * @param {Object} [options={}] - Search options
 * @param {string} [options.search=""] - Search term for ILIKE matching
 * @param {string[]} [options.searchColumns=[]] - Columns to search within
 * @returns {Promise<Object>} Object with count property
 */
export const count = (conditions, options = {}) => {
  const { search = "", searchColumns = [] } = options

  let query = db.count("* as count").from(TABLE_NAME).where(conditions)

  if (search && searchColumns.length) {
    query = query.where(function () {
      for (const col of searchColumns) {
        this.orWhere(col, "ilike", `%${search}%`)
      }
    })
  }

  return query.first()
}

/**
 * Update a todo matching the given conditions.
 *
 * @param {Object} conditions - Key-value pairs to identify the todo
 * @param {Object} todo - Fields to update
 * @returns {Promise<Object[]>} Array containing the updated todo
 */
export const update = (conditions, todo) => {
  return db.update(todo).from(TABLE_NAME).where(conditions).returning(TODO_COLUMNS)
}

/**
 * Delete a todo matching the given conditions.
 *
 * @param {Object} conditions - Key-value pairs to identify the todo
 * @returns {Promise<number>} Number of rows deleted
 */
export const remove = (conditions) => {
  return db.delete().from(TABLE_NAME).where(conditions)
}

/**
 * Delete multiple todos by IDs, scoped to additional conditions (e.g., user_id).
 * Uses whereIn for a single query instead of per-ID deletes.
 *
 * @param {string[]} ids - Array of todo UUIDs to delete
 * @param {Object} conditions - Additional conditions to scope the delete (e.g., { user_id })
 * @returns {Promise<number>} Number of rows deleted
 */
export const removeMany = (ids, conditions) => {
  return db.delete().from(TABLE_NAME).whereIn("id", ids).andWhere(conditions)
}
