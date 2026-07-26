import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common"
import { InvitationsService } from "./invitations.service"
import { OrgsService } from "../orgs/orgs.service"
import { UsersService } from "../users/users.service"
import { CreateInvitationDto } from "./dto/create-invitation.dto"
import { PreviewQueryDto } from "./dto/preview-query.dto"
import { AcceptInvitationDto } from "./dto/accept-invitation.dto"
import { Public } from "../common/decorators/public.decorator"
import { CurrentUser } from "../common/decorators/current-user.decorator"
import { CurrentOrg } from "../common/decorators/current-org.decorator"
import { CurrentProject } from "../common/decorators/current-project.decorator"
import { RequirePermission } from "../common/decorators/require-permission.decorator"
import { OrgGuard } from "../tenancy/org.guard"
import { ProjectGuard } from "../tenancy/project.guard"
import { PermissionsGuard } from "../tenancy/permissions.guard"

@Controller()
export class InvitationsController {
  constructor(
    private readonly invitations: InvitationsService,
    private readonly orgs: OrgsService,
    private readonly users: UsersService,
  ) {}

  private async orgName(orgId: string): Promise<string> {
    const org = await this.orgs.findById(orgId)
    return org?.name ?? ""
  }

  @Post("orgs/:org_id/invitations")
  @UseGuards(OrgGuard, PermissionsGuard)
  @RequirePermission("invitations:create")
  async createForOrg(
    @CurrentOrg() org: { id: string },
    @CurrentUser("id") userId: string,
    @Body() dto: CreateInvitationDto,
  ) {
    return {
      message: "Created",
      data: await this.invitations.create(org.id, null, userId, dto, await this.orgName(org.id)),
    }
  }

  @Post("orgs/:org_id/projects/:project_id/invitations")
  @UseGuards(OrgGuard, ProjectGuard, PermissionsGuard)
  @RequirePermission("invitations:create")
  async createForProject(
    @CurrentOrg() org: { id: string },
    @CurrentProject() project: { id: string },
    @CurrentUser("id") userId: string,
    @Body() dto: CreateInvitationDto,
  ) {
    return {
      message: "Created",
      data: await this.invitations.create(
        org.id,
        project.id,
        userId,
        dto,
        await this.orgName(org.id),
      ),
    }
  }

  @Get("orgs/:org_id/invitations")
  @UseGuards(OrgGuard, PermissionsGuard)
  @RequirePermission("invitations:manage")
  async listForOrg(@CurrentOrg() org: { id: string }) {
    return { message: "OK", data: await this.invitations.listForOrg(org.id) }
  }

  @Delete("orgs/:org_id/invitations/:invitation_id")
  @UseGuards(OrgGuard, PermissionsGuard)
  @RequirePermission("invitations:manage")
  async remove(
    @CurrentOrg() org: { id: string },
    @Param("invitation_id", ParseUUIDPipe) invitationId: string,
  ) {
    await this.invitations.remove(org.id, invitationId)
    return { message: "OK", data: null }
  }

  @Post("orgs/:org_id/invitations/:invitation_id/resend")
  @UseGuards(OrgGuard, PermissionsGuard)
  @RequirePermission("invitations:manage")
  async resend(
    @CurrentOrg() org: { id: string },
    @Param("invitation_id", ParseUUIDPipe) invitationId: string,
  ) {
    return this.invitations.resend(org.id, invitationId, await this.orgName(org.id))
  }

  @Get("invitations")
  async listMine(@CurrentUser("id") userId: string) {
    const user = await this.users.findSafeById(userId)
    return { message: "OK", data: await this.invitations.listMine(userId, user?.email ?? "") }
  }

  @Public()
  @Get("invitations/:invitation_id/preview")
  async preview(
    @Param("invitation_id", ParseUUIDPipe) invitationId: string,
    @Query() query: PreviewQueryDto,
  ) {
    return { message: "OK", data: await this.invitations.preview(invitationId, query.token) }
  }

  @Post("invitations/:invitation_id/accept")
  async accept(
    @Param("invitation_id", ParseUUIDPipe) invitationId: string,
    @CurrentUser("id") userId: string,
    @Body() dto: AcceptInvitationDto,
  ) {
    const user = await this.users.findSafeById(userId)
    return this.invitations.accept(invitationId, userId, user?.email ?? "", dto.token)
  }

  @Post("invitations/:invitation_id/decline")
  async decline(
    @Param("invitation_id", ParseUUIDPipe) invitationId: string,
    @CurrentUser("id") userId: string,
  ) {
    const user = await this.users.findSafeById(userId)
    await this.invitations.decline(invitationId, userId, user?.email ?? "")
    return { message: "OK", data: null }
  }
}
