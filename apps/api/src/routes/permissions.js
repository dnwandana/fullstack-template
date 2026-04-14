/**
 * Permission routes.
 *
 * Mounted under /api/permissions. Provides a read-only endpoint
 * to list all available system permissions. Useful when creating
 * custom roles — clients can fetch the permission list to build
 * a role permission picker UI.
 *
 * @module routes/permissions
 */
import { Router } from "express"
import * as permissionController from "../controllers/permissions.js"

const router = Router()

// List all system permissions (read-only, no org context needed)
router.get("/", permissionController.getPermissions)

export default router
