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

@Injectable()
export class ProjectGuard implements CanActivate {
  constructor(private readonly membership: MembershipService) {}

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
