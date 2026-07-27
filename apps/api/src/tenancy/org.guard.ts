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

/** Gate for `/orgs/:org_id/...`: seeds `req.org` and `req.permissions` for the guards after it. */
@Injectable()
export class OrgGuard implements CanActivate {
  constructor(private readonly membership: MembershipService) {}

  /** Throws 400 on a non-UUID `org_id`, 404 on an unknown org, 403 on a non-member. */
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
    // DELIBERATE (L-13; README "Security trade-offs"): 404 unknown org, 403 non-member. An
    // authenticated existence oracle, accepted because org ids are UUIDs and non-members get an
    // accurate error. Do not "fix" to a uniform 404 — ProjectGuard intentionally does not mirror.
    if (!found) throw new NotFoundException("Organization not found")
    if (!org) throw new ForbiddenException("You are not a member of this organization")

    req.org = org
    req.permissions = permissions
    return true
  }
}
