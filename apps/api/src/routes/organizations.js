/**
 * Organization routes.
 *
 * Mounts org CRUD endpoints and nests sub-resources (projects, roles,
 * members, invitations) under /:org_id. The resolveOrg middleware runs
 * once for all nested routes, loading the org context and user permissions.
 *
 * @module routes/organizations
 */
import { Router } from "express"
import { resolveOrg } from "../middlewares/resolve-org.js"
import { requirePermission } from "../middlewares/require-permission.js"
import * as orgController from "../controllers/organizations.js"
import projectRoutes from "./projects.js"
import roleRoutes from "./roles.js"
import orgMemberRoutes from "./org-members.js"
import orgInvitationRoutes from "./invitations.js"

const router = Router()

// Org CRUD — create and list don't require org context
router.post("/", orgController.createOrg)
router.get("/", orgController.getOrgs)

// All routes below require org context (resolves org, verifies membership, loads permissions)
router.use("/:org_id", resolveOrg)

router.get("/:org_id", requirePermission("org:read"), orgController.getOrg)
router.put("/:org_id", requirePermission("org:update"), orgController.updateOrg)
router.delete("/:org_id", requirePermission("org:delete"), orgController.deleteOrg)

// Nested sub-resource routes (inherit org context from resolveOrg above)
router.use("/:org_id/projects", projectRoutes)
router.use("/:org_id/roles", roleRoutes)
router.use("/:org_id/members", orgMemberRoutes)
router.use("/:org_id/invitations", orgInvitationRoutes)

export default router
