import { applyDecorators, UseGuards } from "@nestjs/common"
import { RequirePermission } from "@shared/decorators/require-permission.decorator"
import { OrgGuard } from "./org.guard"
import { ProjectGuard } from "./project.guard"
import { PermissionsGuard } from "./permissions.guard"

// Guard order is a contract, not a convention: ProjectGuard reads req.org set by OrgGuard,
// PermissionsGuard reads req.permissions set by both. These decorators are the only place that
// order is written down (L-7) — compose them, never hand-roll the raw guard list.

/** Applies `OrgGuard` then `PermissionsGuard`; pass `permission` when every handler shares one. */
export function OrgScoped(permission?: string) {
  return applyDecorators(
    UseGuards(OrgGuard, PermissionsGuard),
    ...(permission ? [RequirePermission(permission)] : []),
  )
}

/** Applies `OrgGuard`, `ProjectGuard`, then `PermissionsGuard`; pass `permission` when shared. */
export function ProjectScoped(permission?: string) {
  return applyDecorators(
    UseGuards(OrgGuard, ProjectGuard, PermissionsGuard),
    ...(permission ? [RequirePermission(permission)] : []),
  )
}
