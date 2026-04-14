/**
 * Root API router.
 *
 * Aggregates all route modules and applies authentication middleware.
 * Auth routes are public; all other routes require a valid access token.
 *
 * Route hierarchy:
 * - /api/auth — authentication (public, rate-limited)
 * - /api/invitations — user-level invitation management
 * - /api/permissions — system permission reference
 * - /api/orgs — organizations and all nested sub-resources
 *
 * @module routes/index
 */
import { Router } from "express"
import { requireAccessToken } from "../middlewares/authorization.js"
import authRoutes from "./authentication.js"
import orgRoutes from "./organizations.js"
import permissionRoutes from "./permissions.js"
import userInvitationRoutes from "./user-invitations.js"

const router = Router()

// Public routes (auth has its own rate limiting)
router.use("/auth", authRoutes)

// All routes below require a valid access token
router.use(requireAccessToken)

// User-level routes (no org context needed)
router.use("/invitations", userInvitationRoutes)
router.use("/permissions", permissionRoutes)

// Org-level routes (org context resolved at route level via resolveOrg)
router.use("/orgs", orgRoutes)

export default router
