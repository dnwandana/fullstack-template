/**
 * Project-level invitation routes.
 *
 * Mounted under /api/orgs/:org_id/projects/:project_id/invitations.
 * Uses mergeParams to inherit org_id and project_id from parent routers.
 * Handles creating invitations scoped to a specific project.
 *
 * @module routes/project-invitations
 */
import { Router } from "express"
import { requirePermission } from "../middlewares/require-permission.js"
import * as invitationController from "../controllers/invitations.js"

const router = Router({ mergeParams: true })

// Create project-level invitations requires invitations:create permission
router.post(
  "/",
  requirePermission("invitations:create"),
  invitationController.createProjectInvitation,
)

export default router
