/**
 * Role routes.
 *
 * Mounted under /api/orgs/:org_id/roles. Uses mergeParams to inherit
 * the org_id parameter from the parent organizations router.
 * Manages custom and system role CRUD within an organization.
 *
 * @module routes/roles
 */
import { Router } from "express"
import { requirePermission } from "../middlewares/require-permission.js"
import * as roleController from "../controllers/roles.js"

const router = Router({ mergeParams: true })

// Create and manage roles requires org:manage_roles permission
router.post("/", requirePermission("org:manage_roles"), roleController.createRole)

// Listing roles only requires org:read
router.get("/", requirePermission("org:read"), roleController.getRoles)
router.get("/:role_id", requirePermission("org:read"), roleController.getRole)

// Updating and deleting roles requires org:manage_roles permission
router.put("/:role_id", requirePermission("org:manage_roles"), roleController.updateRole)
router.delete("/:role_id", requirePermission("org:manage_roles"), roleController.deleteRole)

export default router
