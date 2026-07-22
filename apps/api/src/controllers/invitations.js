import joi from "joi"
import crypto from "node:crypto"
import HttpError from "../utils/http-error.js"
import apiResponse from "../utils/response.js"
import { HTTP_STATUS_CODE, HTTP_STATUS_MESSAGE } from "../utils/constant.js"
import * as invitationModel from "../models/invitations.js"
import * as orgMemberModel from "../models/org-members.js"
import * as orgModel from "../models/organizations.js"
import * as projectMemberModel from "../models/project-members.js"
import * as projectModel from "../models/projects.js"
import * as roleModel from "../models/roles.js"
import * as userModel from "../models/users.js"
import db from "../config/database.js"
import logger from "../utils/logger.js"
import { buildInvitationAcceptUrl } from "../utils/invitation-url.js"
import { sendInvitationEmail } from "../utils/invitation-notifier.js"

/** Standard UUID v4 format validation pattern */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Default invitation expiry: 7 days from creation */
const INVITATION_EXPIRY_DAYS = 7

/**
 * Joi schema for validating invitation request bodies (org and project level).
 * Invitations are email-only — email is the canonical user identifier.
 */
const inviteSchema = joi
  .object({
    email: joi.string().trim().lowercase().email().max(255).required(),
    role_id: joi.string().uuid().required(),
  })
  .options({ stripUnknown: true })

/**
 * Joi schema for validating the accept-invitation request body.
 * Requires the raw 64-character hex invitation token.
 */
const acceptSchema = joi
  .object({
    token: joi.string().length(64).required(),
  })
  .options({ stripUnknown: true })

/**
 * Joi schema for the public preview query string.
 * Validates token shape BEFORE any comparison — timingSafeEqual throws on
 * length mismatch, so an unchecked token is a crash vector.
 */
const previewQuerySchema = joi
  .object({
    token: joi
      .string()
      .length(64)
      .pattern(/^[0-9a-f]+$/)
      .required(),
  })
  .options({ stripUnknown: true })

/**
 * Resolves the invitee user from an email lookup.
 * Returns { inviteeId, inviteeEmail } — inviteeId is null when the user
 * doesn't have an account yet (pending-account invitation).
 *
 * @param {string} email - Invitee's email address
 * @returns {Promise<{ inviteeId: string|null, inviteeEmail: string }>}
 */
const resolveInvitee = async (email) => {
  const user = await userModel.findOne({ email })
  return { inviteeId: user?.id ?? null, inviteeEmail: email }
}

/**
 * Resolve display context for an invitation and hand it to the delivery seam.
 *
 * The single delivery site — create, resend, and anything added later route
 * through here, so wiring a mail provider means editing
 * src/utils/invitation-notifier.js and nothing else.
 *
 * Best-effort by contract: this never throws. Every caller has already
 * committed the invitation row, so neither a provider outage nor a transient
 * failure in the display-name lookups may turn a successful write into a 500 —
 * the invitation stays redeemable via its link regardless.
 *
 * The failure is logged here because it is deliberately not propagated: a
 * swallowed error never reaches errorHandler, so this is its only record.
 *
 * @param {Object} req - Express request (req.id for correlation, req.org.id for scope)
 * @param {Object} params - Invitation details
 * @param {string} params.invitationId - UUID of the invitation
 * @param {string} params.token - Raw invitation token — goes to the invitee, never to a log
 * @param {string} params.inviteeEmail - Address being invited
 * @param {string} params.inviterId - UUID of the user who sent it
 * @param {string} params.roleId - UUID of the role granted on acceptance
 * @param {string|null} params.projectId - UUID of the project, or null for org-level
 * @param {Date} params.expiresAt - When the invitation stops working
 * @returns {Promise<string>} The accept URL, for inclusion in the response
 */
const deliverInvitation = async (
  req,
  { invitationId, token, inviteeEmail, inviterId, roleId, projectId, expiresAt },
) => {
  const acceptUrl = buildInvitationAcceptUrl(invitationId, token)

  try {
    // req.org/req.project/req.user carry IDs only, so display names for the
    // notification are resolved here rather than threaded through by callers.
    const [org, inviter, role, project] = await Promise.all([
      orgModel.findOne({ id: req.org.id }),
      userModel.findOne({ id: inviterId }),
      roleModel.findOne({ id: roleId, org_id: req.org.id }),
      projectId ? projectModel.findOne({ id: projectId }) : null,
    ])

    await sendInvitationEmail({
      to: inviteeEmail,
      acceptUrl,
      orgName: org?.name ?? null,
      projectName: project?.name ?? null,
      inviterName: inviter?.name ?? null,
      roleName: role?.name ?? null,
      expiresAt,
    })
  } catch (deliveryError) {
    logger.error("Invitation delivery failed", {
      requestId: req.id,
      invitationId,
      to: inviteeEmail,
      error: deliveryError.message,
    })
  }

  return acceptUrl
}

/**
 * POST /api/orgs/:org_id/invitations — Create an org-level invitation.
 *
 * Generates a secure random token, hashes it with SHA-256 for storage,
 * and sets a 7-day expiry. Validates that the invitee isn't already an
 * org member and that the specified role belongs to this organization.
 *
 * @param {Object} req - Express request object (req.org.id, req.user.id set by middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const createOrgInvitation = async (req, res, next) => {
  try {
    const { error, value } = inviteSchema.validate(req.body)
    if (error) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message)
    }

    const { email, role_id: roleId } = value

    const role = await roleModel.findOne({ id: roleId, org_id: req.org.id })
    if (!role) {
      throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "Role not found in this organization")
    }

    const { inviteeId, inviteeEmail } = await resolveInvitee(email)

    if (inviteeId) {
      const existingMember = await orgMemberModel.findOne({
        user_id: inviteeId,
        org_id: req.org.id,
      })
      if (existingMember) {
        throw new HttpError(
          HTTP_STATUS_CODE.BAD_REQUEST,
          "User is already a member of this organization",
        )
      }
    }

    const pending = await invitationModel.findPendingForScope({
      invitee_email: inviteeEmail,
      org_id: req.org.id,
      project_id: null,
    })
    if (pending) {
      throw new HttpError(
        HTTP_STATUS_CODE.BAD_REQUEST,
        "A pending invitation already exists for this email",
      )
    }

    const token = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS)

    const [invitation] = await invitationModel.create({
      id: crypto.randomUUID(),
      org_id: req.org.id,
      project_id: null,
      inviter_id: req.user.id,
      invitee_email: inviteeEmail,
      invitee_id: inviteeId,
      role_id: roleId,
      status: "pending",
      token,
      expires_at: expiresAt,
      created_at: new Date(),
      updated_at: new Date(),
    })

    const acceptUrl = await deliverInvitation(req, {
      invitationId: invitation.id,
      token,
      inviteeEmail,
      inviterId: req.user.id,
      roleId,
      projectId: null,
      expiresAt,
    })

    return res.status(HTTP_STATUS_CODE.CREATED).json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.CREATED,
        data: { ...invitation, token, accept_url: acceptUrl },
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * POST /api/orgs/:org_id/projects/:project_id/invitations — Create a project-level invitation.
 *
 * Similar to org invitations, but scoped to a project. If the invitee isn't already
 * an org member, they will be auto-added as a viewer when they accept.
 *
 * @param {Object} req - Express request object (req.org.id, req.project.id, req.user.id)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const createProjectInvitation = async (req, res, next) => {
  try {
    const { error, value } = inviteSchema.validate(req.body)
    if (error) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message)
    }

    const { email, role_id: roleId } = value

    const role = await roleModel.findOne({ id: roleId, org_id: req.org.id })
    if (!role) {
      throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "Role not found in this organization")
    }

    const { inviteeId, inviteeEmail } = await resolveInvitee(email)

    if (inviteeId) {
      const existingMember = await projectMemberModel.findOne({
        user_id: inviteeId,
        project_id: req.project.id,
      })
      if (existingMember) {
        throw new HttpError(
          HTTP_STATUS_CODE.BAD_REQUEST,
          "User is already a member of this project",
        )
      }
    }

    const pending = await invitationModel.findPendingForScope({
      invitee_email: inviteeEmail,
      org_id: req.org.id,
      project_id: req.project.id,
    })
    if (pending) {
      throw new HttpError(
        HTTP_STATUS_CODE.BAD_REQUEST,
        "A pending invitation already exists for this email",
      )
    }

    const token = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS)

    const [invitation] = await invitationModel.create({
      id: crypto.randomUUID(),
      org_id: req.org.id,
      project_id: req.project.id,
      inviter_id: req.user.id,
      invitee_email: inviteeEmail,
      invitee_id: inviteeId,
      role_id: roleId,
      status: "pending",
      token,
      expires_at: expiresAt,
      created_at: new Date(),
      updated_at: new Date(),
    })

    const acceptUrl = await deliverInvitation(req, {
      invitationId: invitation.id,
      token,
      inviteeEmail,
      inviterId: req.user.id,
      roleId,
      projectId: req.project.id,
      expiresAt,
    })

    return res.status(HTTP_STATUS_CODE.CREATED).json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.CREATED,
        data: { ...invitation, token, accept_url: acceptUrl },
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * GET /api/orgs/:org_id/invitations — List all invitations for an organization.
 * Returns invitations enriched with inviter/invitee names and role names.
 *
 * @param {Object} req - Express request object (req.org.id set by middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getOrgInvitations = async (req, res, next) => {
  try {
    const invitations = await invitationModel.findManyByOrgId(req.org.id)

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: invitations,
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * GET /api/invitations — List all pending invitations for the authenticated user.
 * No org context required — scoped by user ID across all organizations.
 * Only returns non-expired, pending invitations.
 *
 * @param {Object} req - Express request object (req.user.id set by auth middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getMyInvitations = async (req, res, next) => {
  try {
    const invitations = await invitationModel.findPendingByUserId(req.user.id)

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: invitations,
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * GET /api/invitations/:invitation_id/preview?token=<64hex> — Public invitation preview.
 *
 * Unauthenticated by design: an invitee must be able to see what they were
 * invited to before creating an account. The raw token is the sole gate.
 * Returns 404 for both "no such invitation" and "wrong token" so the endpoint
 * cannot be used to confirm that an invitation ID exists.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const previewInvitation = async (req, res, next) => {
  try {
    const invitationId = req.params.invitation_id
    if (!UUID_REGEX.test(invitationId)) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "Invalid invitation ID format")
    }

    const { error, value } = previewQuerySchema.validate(req.query)
    if (error) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message)
    }

    const invitation = await invitationModel.findOneWithTokenHash(invitationId)
    if (!invitation || !invitation.token_hash) {
      throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "Invitation not found")
    }

    const submittedHash = invitationModel.hashToken(value.token)
    if (!crypto.timingSafeEqual(Buffer.from(submittedHash), Buffer.from(invitation.token_hash))) {
      throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "Invitation not found")
    }

    const invitee = await userModel.findOne({ email: invitation.invitee_email })

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: {
          id: invitation.id,
          org_name: invitation.org_name,
          project_name: invitation.project_name,
          inviter_name: invitation.inviter_name,
          role_name: invitation.role_name,
          invitee_email: invitation.invitee_email,
          status: invitation.status,
          expires_at: invitation.expires_at,
          is_expired: new Date(invitation.expires_at) < new Date(),
          requires_signup: !invitee,
        },
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * POST /api/invitations/:invitation_id/accept — Accept a pending invitation.
 *
 * Validates the invitation token via timing-safe SHA-256 comparison, verifies
 * the invitation belongs to the authenticated user, is still pending, and hasn't
 * expired. Uses a transaction to atomically:
 * - For org invitations: add user as org member with the invited role
 * - For project invitations: add user as project member; also add to org as viewer
 *   if they aren't already an org member
 * - Mark the invitation as accepted
 *
 * @param {Object} req - Express request object (req.user.id set by auth middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const acceptInvitation = async (req, res, next) => {
  try {
    const invitationId = req.params.invitation_id
    if (!UUID_REGEX.test(invitationId)) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "Invalid invitation ID format")
    }

    const { error, value } = acceptSchema.validate(req.body)
    if (error) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message)
    }

    const { token: rawToken } = value

    await db.transaction(async (trx) => {
      const invitation = await trx("invitations")
        .where({ id: invitationId })
        .select("*")
        .forUpdate()
        .first()

      if (!invitation) {
        throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "Invitation not found")
      }

      const submittedHash = crypto.createHash("sha256").update(rawToken).digest("hex")
      const storedHash = invitation.token_hash
      if (
        !storedHash ||
        !crypto.timingSafeEqual(Buffer.from(submittedHash), Buffer.from(storedHash))
      ) {
        throw new HttpError(HTTP_STATUS_CODE.FORBIDDEN, "Invalid invitation token")
      }

      if (invitation.invitee_id) {
        if (invitation.invitee_id !== req.user.id) {
          throw new HttpError(HTTP_STATUS_CODE.FORBIDDEN, "This invitation does not belong to you")
        }
      } else {
        const currentUser = await trx("users").where({ id: req.user.id }).select("email").first()
        if (!currentUser.email || currentUser.email !== invitation.invitee_email) {
          throw new HttpError(HTTP_STATUS_CODE.FORBIDDEN, "This invitation does not belong to you")
        }
      }

      if (invitation.status !== "pending") {
        throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "Invitation is no longer pending")
      }

      if (new Date(invitation.expires_at) < new Date()) {
        throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "Invitation has expired")
      }

      if (invitation.project_id) {
        const orgMembership = await trx("org_members")
          .where({ user_id: req.user.id, org_id: invitation.org_id })
          .first()

        if (!orgMembership) {
          const viewerRole = await trx("roles")
            .where({ org_id: invitation.org_id, name: "viewer", is_system: true })
            .first()

          if (viewerRole) {
            await trx("org_members").insert({
              user_id: req.user.id,
              org_id: invitation.org_id,
              role_id: viewerRole.id,
            })
          }
        }

        await trx("project_members").insert({
          user_id: req.user.id,
          project_id: invitation.project_id,
          role_id: invitation.role_id,
        })
      } else {
        await trx("org_members").insert({
          user_id: req.user.id,
          org_id: invitation.org_id,
          role_id: invitation.role_id,
        })
      }

      await trx("invitations")
        .where({ id: invitationId })
        .update({ status: "accepted", updated_at: new Date() })
    })

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: null,
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * POST /api/invitations/:invitation_id/decline — Decline a pending invitation.
 *
 * Validates the invitation belongs to the authenticated user (by ID or email)
 * and is still pending. Marks the invitation status as "declined".
 *
 * @param {Object} req - Express request object (req.user.id set by auth middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const declineInvitation = async (req, res, next) => {
  try {
    const invitationId = req.params.invitation_id
    if (!UUID_REGEX.test(invitationId)) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "Invalid invitation ID format")
    }

    await db.transaction(async (trx) => {
      const invitation = await trx("invitations")
        .where({ id: invitationId })
        .select("*")
        .forUpdate()
        .first()

      if (!invitation) {
        throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "Invitation not found")
      }

      if (invitation.invitee_id) {
        if (invitation.invitee_id !== req.user.id) {
          throw new HttpError(HTTP_STATUS_CODE.FORBIDDEN, "This invitation does not belong to you")
        }
      } else {
        const currentUser = await trx("users").where({ id: req.user.id }).select("email").first()
        if (!currentUser.email || currentUser.email !== invitation.invitee_email) {
          throw new HttpError(HTTP_STATUS_CODE.FORBIDDEN, "This invitation does not belong to you")
        }
      }

      if (invitation.status !== "pending") {
        throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "Invitation is no longer pending")
      }

      await trx("invitations")
        .where({ id: invitationId })
        .update({ status: "declined", updated_at: new Date() })
    })

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: null,
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * DELETE /api/orgs/:org_id/invitations/:invitation_id — Revoke (delete) an invitation.
 * Requires invitations:manage permission (checked by middleware).
 * Only invitations belonging to the current org can be revoked.
 *
 * @param {Object} req - Express request object (req.org.id set by middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const revokeInvitation = async (req, res, next) => {
  try {
    const invitationId = req.params.invitation_id
    if (!UUID_REGEX.test(invitationId)) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "Invalid invitation ID format")
    }

    const invitation = await invitationModel.findOne({
      id: invitationId,
      org_id: req.org.id,
    })
    if (!invitation) {
      throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "Invitation not found")
    }

    await invitationModel.remove({ id: invitationId })

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: null,
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * POST /api/orgs/:org_id/invitations/:invitation_id/resend — Reissue an invitation.
 *
 * Mints a fresh token (invalidating the previous one) and resets the expiry
 * window. Only pending invitations can be resent — accepted and declined
 * invitations are terminal.
 *
 * Exists because the raw token is only ever returned once. Without resend, a
 * lost link means the invitation is unrecoverable and the duplicate guard
 * blocks re-inviting the same address.
 *
 * @param {Object} req - Express request object (req.org.id set by middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const resendInvitation = async (req, res, next) => {
  try {
    const invitationId = req.params.invitation_id
    if (!UUID_REGEX.test(invitationId)) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "Invalid invitation ID format")
    }

    const invitation = await invitationModel.findOne({
      id: invitationId,
      org_id: req.org.id,
    })
    if (!invitation) {
      throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "Invitation not found")
    }

    if (invitation.status !== "pending") {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "Invitation is no longer pending")
    }

    const token = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS)

    const [updated] = await invitationModel.update(
      { id: invitationId },
      {
        token_hash: invitationModel.hashToken(token),
        expires_at: expiresAt,
        updated_at: new Date(),
      },
    )

    const acceptUrl = await deliverInvitation(req, {
      invitationId,
      token,
      inviteeEmail: invitation.invitee_email,
      inviterId: invitation.inviter_id,
      roleId: invitation.role_id,
      projectId: invitation.project_id,
      expiresAt,
    })

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: { ...updated, token, accept_url: acceptUrl },
      }),
    )
  } catch (error) {
    return next(error)
  }
}
