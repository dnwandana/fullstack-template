/**
 * Project routes.
 *
 * Mounted under /api/orgs/:org_id/projects. Uses mergeParams to inherit
 * the org_id parameter from the parent organizations router.
 * Nests todos, project members, and project invitations under /:project_id.
 *
 * @module routes/projects
 */
import { Router } from "express"
import { resolveProject } from "../middlewares/resolve-project.js"
import { requirePermission } from "../middlewares/require-permission.js"
import * as projectController from "../controllers/projects.js"
import todosRoutes from "./todos.js"
import projectMemberRoutes from "./project-members.js"
import projectInvitationRoutes from "./project-invitations.js"

const router = Router({ mergeParams: true })

// Project CRUD — create and list only need org context (already resolved)
router.post("/", requirePermission("project:create"), projectController.createProject)
router.get("/", requirePermission("project:read"), projectController.getProjects)

// All routes below require project context (resolves project, merges permissions)
router.use("/:project_id", resolveProject)

router.get("/:project_id", requirePermission("project:read"), projectController.getProject)
router.put("/:project_id", requirePermission("project:update"), projectController.updateProject)
router.delete("/:project_id", requirePermission("project:delete"), projectController.deleteProject)

// Nested sub-resource routes (inherit both org and project context)
router.use("/:project_id/todos", todosRoutes)
router.use("/:project_id/members", projectMemberRoutes)
router.use("/:project_id/invitations", projectInvitationRoutes)

export default router
