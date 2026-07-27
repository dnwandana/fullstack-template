import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { Request } from "express"
import { isUuid } from "@shared/utils/uuid"
import { MembershipService } from "./membership.service"

@Injectable()
export class OrgGuard implements CanActivate {
  constructor(private readonly membership: MembershipService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & {
        user: { id: string }
        params: Record<string, string>
        org?: unknown
        permissions?: string[]
      }
    >()
    const orgId = req.params.org_id
    if (!isUuid(orgId)) throw new BadRequestException("Invalid organization ID format")

    const { org, found, permissions } = await this.membership.resolveOrg(req.user.id, orgId)
    // DELIBERATE (L-13): 404 for unknown org, 403 for real-org-non-member — an
    // authenticated existence oracle, accepted because ids are UUIDs. Specified in
    // the rebuild design; ProjectGuard intentionally does NOT mirror this (uniform
    // 404). Documented in README "Security trade-offs".
    if (!found) throw new NotFoundException("Organization not found")
    if (!org) throw new ForbiddenException("You are not a member of this organization")

    req.org = org
    req.permissions = permissions
    return true
  }
}
