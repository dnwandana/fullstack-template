/**
 * User-level invitation routes (no org context required).
 *
 * Mounted under /api/invitations. These routes allow authenticated users
 * to view their pending invitations and accept/decline them without
 * needing to be in an org context first.
 *
 * @module routes/user-invitations
 */
import { Router } from "express"
import * as invitationController from "../controllers/invitations.js"

const router = Router()

// List pending invitations for the authenticated user
router.get("/", invitationController.getMyInvitations)

// Accept or decline a specific invitation
router.post("/:invitation_id/accept", invitationController.acceptInvitation)
router.post("/:invitation_id/decline", invitationController.declineInvitation)

export default router
