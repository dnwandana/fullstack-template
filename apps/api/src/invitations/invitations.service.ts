import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Prisma } from "@prisma/client"
import { createHash, randomBytes, randomUUID } from "crypto"
import { PrismaService } from "../prisma/prisma.service"
import { toSnakeKeys } from "../common/to-snake-keys"
import { InvitationNotifierService } from "./invitation-notifier.service"
import { buildInvitationAcceptUrl } from "./invitation-url"
import { CreateInvitationDto } from "./dto/create-invitation.dto"
import { PaginationService } from "../common/pagination/pagination.service"
import { ListQueryDto } from "../common/pagination/list-query.dto"

const INVITATION_EXPIRY_DAYS = 7
// Key order mirrors the response shape — Prisma returns columns in select
// order and toSnakeKeys preserves it.
const INVITE_SELECT = {
  id: true,
  orgId: true,
  projectId: true,
  inviterId: true,
  inviteeEmail: true,
  inviteeId: true,
  roleId: true,
  status: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
} as const

// Same pattern as roles.service.ts — replicated locally, not imported across modules.
const isUniqueViolation = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"

type InviteRow = {
  id: string
  orgId: string
  projectId: string | null
  inviterId: string
  inviteeEmail: string | null
  inviteeId: string | null
  roleId: string
  status: string
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: InvitationNotifierService,
    private readonly config: ConfigService,
    private readonly pagination: PaginationService,
  ) {}

  private hash(raw: string): string {
    return createHash("sha256").update(raw).digest("hex")
  }

  private acceptUrl(invitationId: string, rawToken: string): string {
    const base = this.config.get<string>("APP_BASE_URL") ?? ""
    return buildInvitationAcceptUrl(base, invitationId, rawToken)
  }

  async create(
    orgId: string,
    projectId: string | null,
    inviterId: string,
    dto: CreateInvitationDto,
    orgName: string,
  ) {
    // The role must belong to this org — a foreign role id would smuggle another
    // tenant's permission set into this org's membership on accept.
    const role = await this.prisma.role.findFirst({
      where: { id: dto.role_id, orgId },
      select: { id: true },
    })
    if (!role) throw new NotFoundException("Role not found in this organization")

    // Friendly pre-check only — expired pending invites do not count as duplicates.
    // The real backstop for concurrent creates is the partial unique index pair
    // (invitations_pending_*_email_unique), mapped to the same 400 below.
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
        // Clear expired pending rows for this scope first — they still match the
        // partial unique index and would otherwise block a legitimate re-invite.
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
    this.notifier.sendInvitationEmail({
      email: dto.email,
      invitationId: invitation.id,
      rawToken,
      orgName,
    })
    // No mail provider ships with the template: the raw token and accept_url are
    // returned so the caller can deliver the link by hand.
    return {
      ...toSnakeKeys<InviteRow>(invitation),
      token: rawToken,
      accept_url: this.acceptUrl(invitation.id, rawToken),
    }
  }

  async listForOrg(orgId: string, query: ListQueryDto) {
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
      // Destructure the relations off before mapping — nested objects must not
      // reach the shallow key mapper.
      data: rows.map(({ inviter, invitee, role, ...cols }) => ({
        ...toSnakeKeys<InviteRow>(cols),
        inviter_name: inviter.name,
        invitee_name: invitee?.name ?? null,
        role_name: role.name,
      })),
      pagination: this.pagination.buildMeta(query.page, query.limit, totalItems),
    }
  }

  async listMine(userId: string, email: string) {
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
    // Destructure the relations off before mapping — nested objects must not
    // reach the shallow key mapper.
    return rows.map(({ organization, project, inviter, role, ...cols }) => ({
      ...toSnakeKeys<InviteRow>(cols),
      org_name: organization.name,
      project_name: project?.name ?? null,
      inviter_name: inviter.name,
      role_name: role.name,
    }))
  }

  async preview(invitationId: string, rawToken: string) {
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

  async accept(
    invitationId: string,
    userId: string,
    userEmail: string,
    rawToken: string,
  ): Promise<null> {
    return this.prisma.$transaction(async (tx) => {
      // Serialize concurrent accepts of the same invitation (parity with the
      // Express SELECT ... FOR UPDATE) so the status check below is race-free.
      await tx.$queryRaw`SELECT id FROM invitations WHERE id = ${invitationId}::uuid FOR UPDATE`
      // Match on the token hash as well as the id — mirrors preview(). Possession of
      // the emailed secret is required, and a wrong token is reported as "not found"
      // so callers cannot probe which invitation ids exist.
      const invitation = await tx.invitation.findFirst({
        where: { id: invitationId, tokenHash: this.hash(rawToken) },
        select: INVITE_SELECT,
      })
      if (!invitation) throw new NotFoundException("Invitation not found")
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
      return null
    })
  }

  async decline(invitationId: string, userId: string, userEmail: string): Promise<void> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
      select: { id: true, inviteeId: true, inviteeEmail: true, status: true },
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
  }

  async remove(orgId: string, invitationId: string): Promise<void> {
    const { count } = await this.prisma.invitation.deleteMany({
      where: { id: invitationId, orgId },
    })
    if (count === 0) throw new NotFoundException("Invitation not found")
  }

  async resend(orgId: string, invitationId: string, orgName: string) {
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
    this.notifier.sendInvitationEmail({
      email: invitation.inviteeEmail ?? "",
      invitationId,
      rawToken,
      orgName,
    })
    return {
      ...toSnakeKeys<InviteRow>(updated),
      token: rawToken,
      accept_url: this.acceptUrl(invitationId, rawToken),
    }
  }

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
