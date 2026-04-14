/**
 * Organization-level invitation routes.
 *
 * Mounted under /api/orgs/:org_id/invitations. Uses mergeParams to inherit
 * the org_id parameter from the parent organizations router.
 * Handles creating, listing, and revoking invitations within an org.
 *
 * @module routes/invitations
 */
import { Router } from "express"
import { requirePermission } from "../middlewares/require-permission.js"
import * as invitationController from "../controllers/invitations.js"

const router = Router({ mergeParams: true })

// Create invitations requires invitations:create permission
router.post("/", requirePermission("invitations:create"), invitationController.createOrgInvitation)

// Listing and revoking invitations requires invitations:manage permission
router.get("/", requirePermission("invitations:manage"), invitationController.getOrgInvitations)
router.delete(
  "/:invitation_id",
  requirePermission("invitations:manage"),
  invitationController.revokeInvitation,
)

export default router
