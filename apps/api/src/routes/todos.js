/**
 * Todo routes.
 *
 * Mounted under /api/orgs/:org_id/projects/:project_id/todos.
 * Uses mergeParams to inherit org_id and project_id from parent routers.
 * All routes are gated by permission middleware (todos:read, todos:create, etc.).
 *
 * @module routes/todos
 */
import { Router } from "express"
import { requirePermission } from "../middlewares/require-permission.js"
import * as todoController from "../controllers/todos.js"

const router = Router({ mergeParams: true })

router
  .route("/")
  .get(requirePermission("todos:read"), todoController.getTodos)
  .post(requirePermission("todos:create"), todoController.createTodo)
  .delete(requirePermission("todos:delete"), todoController.deleteTodos)

router
  .route("/:todo_id")
  .get(todoController.requireTodoIdParam, requirePermission("todos:read"), todoController.getTodo)
  .put(
    todoController.requireTodoIdParam,
    requirePermission("todos:update"),
    todoController.updateTodo,
  )
  .delete(
    todoController.requireTodoIdParam,
    requirePermission("todos:delete"),
    todoController.deleteTodo,
  )

export default router
