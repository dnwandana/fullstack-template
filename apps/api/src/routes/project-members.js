/**
 * Project-level member routes.
 *
 * Mounted under /api/orgs/:org_id/projects/:project_id/members.
 * Uses mergeParams to inherit org_id and project_id from parent routers.
 * Handles listing, updating roles, and removing project members.
 *
 * The members controller auto-detects whether it's in org or project context
 * based on the presence of req.project (set by resolveProject middleware).
 *
 * @module routes/project-members
 */
import { Router } from "express"
import { requirePermission } from "../middlewares/require-permission.js"
import * as memberController from "../controllers/members.js"

const router = Router({ mergeParams: true })

// List project members — requires project:read permission
router.get("/", requirePermission("project:read"), memberController.getMembers)

// Updating and removing members requires project:manage_members permission
router.put(
  "/:user_id",
  requirePermission("project:manage_members"),
  memberController.updateMemberRole,
)
router.delete(
  "/:user_id",
  requirePermission("project:manage_members"),
  memberController.removeMember,
)

export default router
