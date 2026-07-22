/**
 * Public (unauthenticated) invitation routes.
 *
 * Mounted under /api/invitations ABOVE the requireAccessToken barrier in
 * routes/index.js, so a logged-out invitee can preview what they were invited
 * to. Access is gated entirely by possession of the raw invitation token.
 *
 * Only add routes here that are safe to expose anonymously.
 *
 * @module routes/public-invitations
 */
import { Router } from "express"
import * as invitationController from "../controllers/invitations.js"

const router = Router()

router.get("/:invitation_id/preview", invitationController.previewInvitation)

export default router
