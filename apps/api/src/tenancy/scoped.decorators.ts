import { applyDecorators, UseGuards } from "@nestjs/common"
import { RequirePermission } from "@shared/decorators/require-permission.decorator"
import { OrgGuard } from "./org.guard"
import { ProjectGuard } from "./project.guard"
import { PermissionsGuard } from "./permissions.guard"

// Guard order is a contract, not a convention: ProjectGuard reads req.org set by
// OrgGuard; PermissionsGuard reads req.permissions set by Org/ProjectGuard.
// These decorators are the only place that order is written down (L-7).

export function OrgScoped(permission?: string) {
  return applyDecorators(
    UseGuards(OrgGuard, PermissionsGuard),
    ...(permission ? [RequirePermission(permission)] : []),
  )
}

export function ProjectScoped(permission?: string) {
  return applyDecorators(
    UseGuards(OrgGuard, ProjectGuard, PermissionsGuard),
    ...(permission ? [RequirePermission(permission)] : []),
  )
}
