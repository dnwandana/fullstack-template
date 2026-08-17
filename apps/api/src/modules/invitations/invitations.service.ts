import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Prisma } from "@prisma/client"
import { createHash, randomBytes, randomUUID } from "crypto"
import { PrismaService } from "@core/database/prisma.service"
import { AuditService } from "@core/audit/audit.service"
import { InvitationNotifierService } from "./invitation-notifier.service"
import { buildInvitationAcceptUrl } from "./invitation-url"
import { CreateInvitationDto } from "./dto/create-invitation.dto"
import { INVITE_SELECT, type InviteRow } from "./invite-row"
import {
  InvitationListResponse,
  InvitationPreviewResponse,
  InvitationWithTokenResponse,
  MyInvitationResponse,
  toInvitationResponse,
} from "./dto/invitation.response"
import { PaginationService } from "@shared/pagination/pagination.service"
import { ListQueryDto } from "@shared/pagination/list-query.dto"

const INVITATION_EXPIRY_DAYS = 7

// Same pattern as roles.service.ts — replicated locally, not imported across modules.
const isUniqueViolation = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"

/**
 * Invitation lifecycle: create, list, preview, accept, decline, revoke, resend. Only a token's
 * SHA-256 hash is stored, so the raw token is returned exactly twice — at create and at resend.
 * Expiry is derived, never written: every read compares `expiresAt` against now.
 */
@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: InvitationNotifierService,
    private readonly config: ConfigService,
    private readonly pagination: PaginationService,
    private readonly audit: AuditService,
  ) {}

  private hash(raw: string): string {
    return createHash("sha256").update(raw).digest("hex")
  }

  private acceptUrl(invitationId: string, rawToken: string): string {
    const base = this.config.get<string>("APP_BASE_URL") ?? ""
    return buildInvitationAcceptUrl(base, invitationId, rawToken)
  }

  /**
   * Creates an invitation and enqueues its email. 404 for a role outside `orgId`; 400 for a
   * pending unexpired invitation on the same (email, org, project) scope. The returned raw token
   * is not stored and can never be retrieved again.
   */
  async create(
    orgId: string,
    projectId: string | null,
    inviterId: string,
    dto: CreateInvitationDto,
    orgName: string,
  ): Promise<InvitationWithTokenResponse> {
    // The role must belong to this org — a foreign role id would smuggle another tenant's
    // permission set into this org's membership on accept.
    const role = await this.prisma.role.findFirst({
      where: { id: dto.role_id, orgId },
      select: { id: true },
    })
    if (!role) throw new NotFoundException("Role not found in this organization")

    // Friendly pre-check only — expired pending invites are not duplicates. The real backstop for
    // concurrent creates is the partial unique index pair (invitations_pending_*_email_unique),
    // mapped to the same 400 below.
    const duplicate = await this.prisma.invitation.findFirst({
      where: {
        inviteeEmail: dto.email,
        orgId,
        projectId,
        status: "pending",
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    })
    if (duplicate) {
      throw new BadRequestException("A pending invitation already exists for this email")
    }

    const rawToken = randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 86400000)
    const invitee = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    })
    let invitation: InviteRow
    try {
      invitation = await this.prisma.$transaction(async (tx) => {
        // Clear expired pending rows for this scope first — they still match the partial unique
        // index and would otherwise block a legitimate re-invite.
        await tx.invitation.deleteMany({
          where: {
            orgId,
            projectId,
            inviteeEmail: dto.email,
            status: "pending",
            expiresAt: { lte: new Date() },
          },
        })
        return tx.invitation.create({
          data: {
            id: randomUUID(),
            orgId,
            projectId,
            inviterId,
            inviteeEmail: dto.email,
            roleId: dto.role_id,
            inviteeId: invitee?.id ?? null,
            tokenHash: this.hash(rawToken),
            status: "pending",
            expiresAt,
          },
          select: INVITE_SELECT,
        })
      })
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new BadRequestException("A pending invitation already exists for this email")
      }
      throw err
    }
    // After the transaction commits, so a rolled-back create leaves no entry. The raw token must
    // never appear in an audit entry; the invitee email is the invitation's public subject.
    await this.audit.record({
      orgId,
      actorId: inviterId,
      action: "invitation.created",
      entityType: "invitation",
      entityId: invitation.id,
      entityName: invitation.inviteeEmail ?? "unknown",
    })
    // Awaited, not fire-and-forget: an unawaited rejection is an invitee who never gets the link
    // and a request that reported success.
    await this.notifier.sendInvitationEmail({
      email: dto.email,
      invitationId: invitation.id,
      rawToken,
      orgName,
    })
    // No mail provider ships with the template, so the raw token and accept_url are returned for
    // the caller to deliver by hand — wire contract, not debugging leftovers.
    return {
      ...toInvitationResponse(invitation),
      token: rawToken,
      accept_url: this.acceptUrl(invitation.id, rawToken),
    }
  }

  /** Every invitation in the org, any status — paginated, newest first. */
  async listForOrg(orgId: string, query: ListQueryDto): Promise<InvitationListResponse> {
    const where = { orgId }
    const totalItems = await this.prisma.invitation.count({ where })
    const rows = await this.prisma.invitation.findMany({
      where,
      select: {
        ...INVITE_SELECT,
        inviter: { select: { name: true } },
        invitee: { select: { name: true } },
        role: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    })
    return {
      // Destructure the relations off before mapping — the key mapper is shallow.
      data: rows.map(({ inviter, invitee, role, ...cols }) => ({
        ...toInvitationResponse(cols),
        inviter_name: inviter.name,
        invitee_name: invitee?.name ?? null,
        role_name: role.name,
      })),
      pagination: this.pagination.buildMeta(query.page, query.limit, totalItems),
    }
  }

  /**
   * The caller's own pending, unexpired invitations, matched by user id **or** email so an invite
   * sent before signup still appears. Deliberately unpaginated — returns a bare array.
   */
  async listMine(userId: string, email: string): Promise<MyInvitationResponse[]> {
    const rows = await this.prisma.invitation.findMany({
      where: {
        status: "pending",
        expiresAt: { gt: new Date() },
        OR: [{ inviteeId: userId }, { inviteeEmail: email }],
      },
      select: {
        ...INVITE_SELECT,
        organization: { select: { name: true } },
        project: { select: { name: true } },
        inviter: { select: { name: true } },
        role: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    })
    // Destructure the relations off before mapping — the key mapper is shallow.
    return rows.map(({ organization, project, inviter, role, ...cols }) => ({
      ...toInvitationResponse(cols),
      org_name: organization.name,
      project_name: project?.name ?? null,
      inviter_name: inviter.name,
      role_name: role.name,
    }))
  }

  /**
   * Unauthenticated read for a logged-out invitee; possession of `rawToken` is the only
   * credential. Throws 404 for both an unknown id and a wrong token, so neither enumerates.
   * Projects its own narrow selection — the caller must not see org_id, inviter_id or role_id.
   */
  async preview(invitationId: string, rawToken: string): Promise<InvitationPreviewResponse> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, tokenHash: this.hash(rawToken) },
      select: {
        id: true,
        inviteeEmail: true,
        inviteeId: true,
        status: true,
        expiresAt: true,
        organization: { select: { name: true } },
        project: { select: { name: true } },
        inviter: { select: { name: true } },
        role: { select: { name: true } },
      },
    })
    if (!invitation) throw new NotFoundException("Invitation not found")
    const invitee = invitation.inviteeId
      ? { id: invitation.inviteeId }
      : invitation.inviteeEmail
        ? await this.prisma.user.findUnique({
            where: { email: invitation.inviteeEmail },
            select: { id: true },
          })
        : null
    return {
      id: invitation.id,
      org_name: invitation.organization.name,
      project_name: invitation.project?.name ?? null,
      inviter_name: invitation.inviter.name,
      role_name: invitation.role.name,
      invitee_email: invitation.inviteeEmail,
      status: invitation.status,
      expires_at: invitation.expiresAt,
      is_expired: invitation.expiresAt < new Date(),
      requires_signup: !invitee,
    }
  }

  /**
   * Redeems an invitation into a membership row. Two gates apply **in order**: 404 when id and
   * token hash do not both match, then 403 on ownership — so a wrong token cannot probe which
   * invitation ids exist. A project invite also adds the user to the parent org as `viewer`.
   */
  async accept(
    invitationId: string,
    userId: string,
    userEmail: string,
    rawToken: string,
  ): Promise<null> {
    // The transaction returns the row it consumed; the audit entries are recorded after the
    // commit, so a rolled-back accept leaves no entry.
    const accepted = await this.prisma.$transaction(async (tx) => {
      // Serialize concurrent accepts (parity with the Express SELECT ... FOR UPDATE) so the
      // status check below is race-free.
      await tx.$queryRaw`SELECT id FROM invitations WHERE id = ${invitationId}::uuid FOR UPDATE`
      // Gate 1, and it must precede the ownership check below: match on the token hash as well as
      // the id (as preview() does) and report either half wrong as 404, so a caller holding a bad
      // token cannot probe which invitation ids exist.
      const invitation = await tx.invitation.findFirst({
        where: { id: invitationId, tokenHash: this.hash(rawToken) },
        select: INVITE_SELECT,
      })
      if (!invitation) throw new NotFoundException("Invitation not found")
      // Gate 2: being the invitee is not sufficient on its own — the raw link is required too.
      if (invitation.inviteeId !== userId && invitation.inviteeEmail !== userEmail) {
        throw new ForbiddenException("This invitation does not belong to you")
      }
      if (invitation.status !== "pending")
        throw new BadRequestException("Invitation is no longer pending")
      if (invitation.expiresAt < new Date()) throw new BadRequestException("Invitation has expired")

      if (invitation.projectId) {
        const existingProject = await tx.projectMember.findUnique({
          where: { userId_projectId: { userId, projectId: invitation.projectId } },
          select: { userId: true },
        })
        if (existingProject) {
          throw new BadRequestException("You are already a member of this project")
        }
        const viewerRole = await tx.role.findFirstOrThrow({
          where: { orgId: invitation.orgId, name: "viewer" },
          select: { id: true },
        })
        const existingOrg = await tx.orgMember.findUnique({
          where: { userId_orgId: { userId, orgId: invitation.orgId } },
          select: { userId: true },
        })
        if (!existingOrg) {
          await tx.orgMember.create({
            data: { orgId: invitation.orgId, userId, roleId: viewerRole.id },
          })
        }
        await tx.projectMember.create({
          data: { projectId: invitation.projectId, userId, roleId: invitation.roleId },
        })
      } else {
        const existingOrg = await tx.orgMember.findUnique({
          where: { userId_orgId: { userId, orgId: invitation.orgId } },
          select: { userId: true },
        })
        if (existingOrg) {
          throw new BadRequestException("You are already a member of this organization")
        }
        await tx.orgMember.create({
          data: { orgId: invitation.orgId, userId, roleId: invitation.roleId },
        })
      }

      await tx.invitation.update({
        where: { id: invitationId },
        data: { status: "accepted", inviteeId: userId },
      })
      return invitation
    })
    // The invitee added themselves by accepting, so they are the actor of both entries. No row
    // in the transaction holds the invitee's name, so one lookup resolves it here.
    const invitee = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    })
    await this.audit.record({
      orgId: accepted.orgId,
      actorId: userId,
      action: "invitation.accepted",
      entityType: "invitation",
      entityId: accepted.id,
      entityName: accepted.inviteeEmail ?? "unknown",
    })
    await this.audit.record({
      orgId: accepted.orgId,
      actorId: userId,
      action: "member.added",
      entityType: "member",
      entityId: userId,
      entityName: invitee?.name ?? "unknown",
    })
    return null
  }

  /**
   * Invitee-side refusal. No raw token needed — unlike accept, this grants nothing, so id plus
   * ownership is enough. 404 unknown, 403 not yours, 400 once no longer pending.
   */
  async decline(invitationId: string, userId: string, userEmail: string): Promise<void> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
      select: { id: true, orgId: true, inviteeId: true, inviteeEmail: true, status: true },
    })
    if (!invitation) throw new NotFoundException("Invitation not found")
    if (invitation.inviteeId !== userId && invitation.inviteeEmail !== userEmail) {
      throw new ForbiddenException("This invitation does not belong to you")
    }
    if (invitation.status !== "pending")
      throw new BadRequestException("Invitation is no longer pending")
    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: "declined" },
    })
    await this.audit.record({
      orgId: invitation.orgId,
      actorId: userId,
      action: "invitation.declined",
      entityType: "invitation",
      entityId: invitation.id,
      entityName: invitation.inviteeEmail ?? "unknown",
    })
  }

  /** Admin revoke: hard-deletes the row, scoped to `orgId`. 404 when the pair matches nothing. */
  async remove(orgId: string, actorId: string, invitationId: string): Promise<void> {
    // Read the email before the delete removes the row; the deleteMany count stays the 404 gate,
    // so a row that a concurrent revoke already deleted records no entry.
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, orgId },
      select: { inviteeEmail: true },
    })
    const { count } = await this.prisma.invitation.deleteMany({
      where: { id: invitationId, orgId },
    })
    if (count === 0) throw new NotFoundException("Invitation not found")
    await this.audit.record({
      orgId,
      actorId,
      action: "invitation.revoked",
      entityType: "invitation",
      entityId: invitationId,
      entityName: invitation?.inviteeEmail ?? "unknown",
    })
  }

  /**
   * Re-issues the token and restarts the 7-day clock, invalidating any link already sent. 404
   * outside `orgId`, 400 once no longer pending. Second and last place a raw token is returned.
   */
  async resend(
    orgId: string,
    actorId: string,
    invitationId: string,
    orgName: string,
  ): Promise<InvitationWithTokenResponse> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, orgId },
      select: { id: true, inviteeEmail: true, status: true },
    })
    if (!invitation) throw new NotFoundException("Invitation not found")
    if (invitation.status !== "pending") {
      throw new BadRequestException("Invitation is no longer pending")
    }
    const rawToken = randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 86400000)
    const updated = await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { tokenHash: this.hash(rawToken), expiresAt },
      select: INVITE_SELECT,
    })
    await this.audit.record({
      orgId,
      actorId,
      action: "invitation.resent",
      entityType: "invitation",
      entityId: invitationId,
      entityName: invitation.inviteeEmail ?? "unknown",
    })
    await this.notifier.sendInvitationEmail({
      email: invitation.inviteeEmail ?? "",
      invitationId,
      rawToken,
      orgName,
    })
    return {
      ...toInvitationResponse(updated),
      token: rawToken,
      accept_url: this.acceptUrl(invitationId, rawToken),
    }
  }

  /**
   * Signup backfill: stamps `inviteeId` onto pending, unexpired invitations already addressed to
   * `email`, so they surface in listMine(). Silent no-op when there are none.
   */
  async linkInviteeByEmail(email: string, userId: string): Promise<void> {
    await this.prisma.invitation.updateMany({
      where: {
        inviteeEmail: email,
        inviteeId: null,
        status: "pending",
        expiresAt: { gt: new Date() },
      },
      data: { inviteeId: userId },
    })
  }
}
