import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common"
import { InvitationsService } from "./invitations.service"
import { OrgsService } from "@modules/orgs/orgs.service"
import { UsersService } from "@modules/users/users.service"
import { CreateInvitationDto } from "./dto/create-invitation.dto"
import { PreviewQueryDto } from "./dto/preview-query.dto"
import { AcceptInvitationDto } from "./dto/accept-invitation.dto"
import {
  InvitationListItemResponse,
  InvitationPreviewResponse,
  InvitationWithTokenResponse,
  MyInvitationResponse,
} from "./dto/invitation.response"
import type { Payload } from "@shared/dto/response.types"
import { ListQueryDto } from "@shared/pagination/list-query.dto"
import { Public } from "@shared/decorators/public.decorator"
import { CurrentUser } from "@shared/decorators/current-user.decorator"
import { CurrentOrg } from "@shared/decorators/current-org.decorator"
import { CurrentProject } from "@shared/decorators/current-project.decorator"
import { OrgScoped, ProjectScoped } from "@tenancy/scoped.decorators"

/**
 * Two route families on one controller, which is why `@Controller()` carries no path: admin routes
 * under `orgs/:org_id/...` guarded by `@OrgScoped`/`@ProjectScoped`, and invitee routes at
 * `invitations/...` authorized by the invitation row itself — or, for preview, the raw token alone.
 */
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
  @OrgScoped("invitations:create")
  async createForOrg(
    @CurrentOrg() org: { id: string },
    @CurrentUser("id") userId: string,
    @Body() dto: CreateInvitationDto,
  ): Promise<Payload<InvitationWithTokenResponse>> {
    return {
      message: "Created",
      data: await this.invitations.create(org.id, null, userId, dto, await this.orgName(org.id)),
    }
  }

  // Project-scoped invite; accepting it also joins the parent org as `viewer` if needed.
  @Post("orgs/:org_id/projects/:project_id/invitations")
  @ProjectScoped("invitations:create")
  async createForProject(
    @CurrentOrg() org: { id: string },
    @CurrentProject() project: { id: string },
    @CurrentUser("id") userId: string,
    @Body() dto: CreateInvitationDto,
  ): Promise<Payload<InvitationWithTokenResponse>> {
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
  @OrgScoped("invitations:manage")
  async listForOrg(
    @CurrentOrg() org: { id: string },
    @Query() query: ListQueryDto,
  ): Promise<Payload<InvitationListItemResponse[]>> {
    return { message: "OK", ...(await this.invitations.listForOrg(org.id, query)) }
  }

  @Delete("orgs/:org_id/invitations/:invitation_id")
  @OrgScoped("invitations:manage")
  async remove(
    @CurrentOrg() org: { id: string },
    @CurrentUser("id") userId: string,
    @Param("invitation_id", ParseUUIDPipe) invitationId: string,
  ): Promise<Payload<null>> {
    await this.invitations.remove(org.id, userId, invitationId)
    return { message: "OK", data: null }
  }

  // Re-issues the token, so any link already delivered stops working.
  @Post("orgs/:org_id/invitations/:invitation_id/resend")
  @HttpCode(HttpStatus.OK)
  @OrgScoped("invitations:manage")
  async resend(
    @CurrentOrg() org: { id: string },
    @CurrentUser("id") userId: string,
    @Param("invitation_id", ParseUUIDPipe) invitationId: string,
  ): Promise<Payload<InvitationWithTokenResponse>> {
    const data = await this.invitations.resend(
      org.id,
      userId,
      invitationId,
      await this.orgName(org.id),
    )
    return { message: "OK", data }
  }

  @Get("invitations")
  async listMine(@CurrentUser("id") userId: string): Promise<Payload<MyInvitationResponse[]>> {
    const user = await this.users.findSafeById(userId)
    return { message: "OK", data: await this.invitations.listMine(userId, user?.email ?? "") }
  }

  // Public: a logged-out invitee reads this before signing up. The raw `token` query param is the
  // only credential, and an unknown id and a wrong token are both 404 so neither enumerates.
  @Public()
  @Get("invitations/:invitation_id/preview")
  async preview(
    @Param("invitation_id", ParseUUIDPipe) invitationId: string,
    @Query() query: PreviewQueryDto,
  ): Promise<Payload<InvitationPreviewResponse>> {
    return { message: "OK", data: await this.invitations.preview(invitationId, query.token) }
  }

  // Authenticated *and* token-gated: being the invitee is not enough without the raw link.
  @Post("invitations/:invitation_id/accept")
  @HttpCode(HttpStatus.OK)
  async accept(
    @Param("invitation_id", ParseUUIDPipe) invitationId: string,
    @CurrentUser("id") userId: string,
    @Body() dto: AcceptInvitationDto,
  ): Promise<Payload<null>> {
    const user = await this.users.findSafeById(userId)
    await this.invitations.accept(invitationId, userId, user?.email ?? "", dto.token)
    return { message: "OK", data: null }
  }

  @Post("invitations/:invitation_id/decline")
  @HttpCode(HttpStatus.OK)
  async decline(
    @Param("invitation_id", ParseUUIDPipe) invitationId: string,
    @CurrentUser("id") userId: string,
  ): Promise<Payload<null>> {
    const user = await this.users.findSafeById(userId)
    await this.invitations.decline(invitationId, userId, user?.email ?? "")
    return { message: "OK", data: null }
  }
}
