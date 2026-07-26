import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { createHash, randomBytes, randomUUID } from "crypto"
import { PrismaService } from "../prisma/prisma.service"
import { InvitationNotifierService } from "./invitation-notifier.service"
import { buildInvitationAcceptUrl } from "./invitation-url"
import { CreateInvitationDto } from "./dto/create-invitation.dto"

const INVITATION_EXPIRY_DAYS = 7
const INVITE_SELECT = {
  id: true,
  orgId: true,
  projectId: true,
  inviterId: true,
  roleId: true,
  inviteeEmail: true,
  inviteeId: true,
  status: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
} as const

type InviteRow = {
  id: string
  orgId: string
  projectId: string | null
  inviterId: string
  roleId: string
  inviteeEmail: string | null
  inviteeId: string | null
  status: string
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}

// API responses keep the Express-era snake_case contract the SPA consumes.
const toSnake = (row: InviteRow) => ({
  id: row.id,
  org_id: row.orgId,
  project_id: row.projectId,
  inviter_id: row.inviterId,
  invitee_email: row.inviteeEmail,
  invitee_id: row.inviteeId,
  role_id: row.roleId,
  status: row.status,
  expires_at: row.expiresAt,
  created_at: row.createdAt,
  updated_at: row.updatedAt,
})

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: InvitationNotifierService,
    private readonly config: ConfigService,
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

    const duplicate = await this.prisma.invitation.findFirst({
      where: { inviteeEmail: dto.email, orgId, projectId, status: "pending" },
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
    const invitation = await this.prisma.invitation.create({
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
    this.notifier.sendInvitationEmail({
      email: dto.email,
      invitationId: invitation.id,
      rawToken,
      orgName,
    })
    // No mail provider ships with the template: the raw token and accept_url are
    // returned so the caller can deliver the link by hand.
    return {
      ...toSnake(invitation),
      token: rawToken,
      accept_url: this.acceptUrl(invitation.id, rawToken),
    }
  }

  async listForOrg(orgId: string) {
    const rows = await this.prisma.invitation.findMany({
      where: { orgId },
      select: {
        ...INVITE_SELECT,
        inviter: { select: { name: true } },
        invitee: { select: { name: true } },
        role: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    })
    return rows.map((r) => ({
      ...toSnake(r),
      inviter_name: r.inviter.name,
      invitee_name: r.invitee?.name ?? null,
      role_name: r.role.name,
    }))
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
    return rows.map((r) => ({
      ...toSnake(r),
      org_name: r.organization.name,
      project_name: r.project?.name ?? null,
      inviter_name: r.inviter.name,
      role_name: r.role.name,
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

  async accept(invitationId: string, userId: string, userEmail: string, rawToken: string) {
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
      return { message: "OK", data: null }
    })
  }

  async decline(invitationId: string, userId: string, userEmail: string): Promise<void> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
      select: { id: true, inviteeId: true, inviteeEmail: true },
    })
    if (!invitation) throw new NotFoundException("Invitation not found")
    if (invitation.inviteeId !== userId && invitation.inviteeEmail !== userEmail) {
      throw new ForbiddenException("This invitation does not belong to you")
    }
    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: "declined" },
    })
  }

  async remove(orgId: string, invitationId: string): Promise<void> {
    await this.prisma.invitation.deleteMany({ where: { id: invitationId, orgId } })
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
      message: "OK",
      data: {
        ...toSnake(updated),
        token: rawToken,
        accept_url: this.acceptUrl(invitationId, rawToken),
      },
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
