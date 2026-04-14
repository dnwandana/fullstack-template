/**
 * Organization-level member routes.
 *
 * Mounted under /api/orgs/:org_id/members. Uses mergeParams to inherit
 * the org_id parameter from the parent organizations router.
 * Handles listing, updating roles, and removing org members.
 *
 * The members controller auto-detects whether it's in org or project context
 * based on the presence of req.project (set by resolveProject middleware).
 *
 * @module routes/org-members
 */
import { Router } from "express"
import { requirePermission } from "../middlewares/require-permission.js"
import * as memberController from "../controllers/members.js"

const router = Router({ mergeParams: true })

// List org members — requires org:read permission (all system roles have it)
router.get("/", requirePermission("org:read"), memberController.getMembers)

// Updating and removing members requires org:manage_members permission
router.put("/:user_id", requirePermission("org:manage_members"), memberController.updateMemberRole)
router.delete("/:user_id", requirePermission("org:manage_members"), memberController.removeMember)

export default router
