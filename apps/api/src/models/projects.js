import db from "../config/database.js"

const TABLE_NAME = "projects"
const COLUMNS = ["id", "org_id", "name", "description", "created_by", "created_at", "updated_at"]

/**
 * Insert a new project into the database.
 *
 * @param {Object} project - Project data to insert
 * @param {string} project.org_id - UUID of the organization this project belongs to
 * @param {string} project.name - Project name
 * @param {string} [project.description] - Project description
 * @param {string} project.created_by - UUID of the user creating the project
 * @returns {Promise<Object[]>} Array containing the newly created project
 */
export const create = (project) => {
  return db.insert(project).into(TABLE_NAME).returning(COLUMNS)
}

/**
 * Find a single project matching the given conditions.
 *
 * @param {Object} conditions - Key-value pairs to match against (e.g., { id, org_id })
 * @returns {Promise<Object|undefined>} The matched project or undefined
 */
export const findOne = (conditions) => {
  return db.select(COLUMNS).from(TABLE_NAME).where(conditions).first()
}

/**
 * Find all projects belonging to an organization, ordered by name.
 *
 * @param {string} orgId - UUID of the organization
 * @returns {Promise<Object[]>} Array of projects in the organization
 */
export const findManyByOrgId = (orgId) => {
  return db.select(COLUMNS).from(TABLE_NAME).where("org_id", orgId).orderBy("name")
}

/**
 * Find all projects a specific user is a member of within an organization.
 * Joins the project_members table to filter by user membership.
 *
 * @param {string} orgId - UUID of the organization
 * @param {string} userId - UUID of the user
 * @returns {Promise<Object[]>} Array of projects the user belongs to
 */
export const findManyByUserId = (orgId, userId) => {
  return db
    .select(COLUMNS.map((col) => `${TABLE_NAME}.${col}`))
    .from(TABLE_NAME)
    .join("project_members", `${TABLE_NAME}.id`, "project_members.project_id")
    .where({ [`${TABLE_NAME}.org_id`]: orgId, "project_members.user_id": userId })
}

/**
 * Update a project matching the given conditions.
 *
 * @param {Object} conditions - Key-value pairs to identify the project
 * @param {Object} data - Fields to update (e.g., { name, description })
 * @returns {Promise<Object[]>} Array containing the updated project
 */
export const update = (conditions, data) => {
  return db.update(data).from(TABLE_NAME).where(conditions).returning(COLUMNS)
}

/**
 * Delete a project matching the given conditions.
 * Related records (members, todos) are removed via CASCADE.
 *
 * @param {Object} conditions - Key-value pairs to identify the project
 * @returns {Promise<number>} Number of rows deleted
 */
export const remove = (conditions) => {
  return db.delete().from(TABLE_NAME).where(conditions)
}
