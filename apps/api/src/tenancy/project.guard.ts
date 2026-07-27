import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { Request } from "express"
import { isUuid } from "@shared/utils/uuid"
import { MembershipService } from "./membership.service"

/**
 * Gate for nested `/projects/:project_id/...` routes: sets `req.project` and merges the caller's
 * project-role permissions into the org permissions `OrgGuard` already put on the request.
 */
@Injectable()
export class ProjectGuard implements CanActivate {
  constructor(private readonly membership: MembershipService) {}

  /**
   * Throws 400 on a non-UUID `project_id` and a uniform 404 when the project is missing or belongs
   * to another org — deliberately not `OrgGuard`'s 404/403 split.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & {
        user: { id: string }
        params: Record<string, string>
        org: { id: string }
        project?: unknown
        permissions: string[]
      }
    >()
    const projectId = req.params.project_id
    if (!isUuid(projectId)) throw new BadRequestException("Invalid project ID format")

    const { project, permissions } = await this.membership.resolveProject(
      req.user.id,
      req.org.id,
      projectId,
      req.permissions,
    )
    if (!project) throw new NotFoundException("Project not found")

    req.project = project
    req.permissions = permissions
    return true
  }
}
