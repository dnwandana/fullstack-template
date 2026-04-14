import joi from "joi"
import crypto from "node:crypto"
import HttpError from "../utils/http-error.js"
import apiResponse from "../utils/response.js"
import { HTTP_STATUS_CODE, HTTP_STATUS_MESSAGE } from "../utils/constant.js"
import * as invitationModel from "../models/invitations.js"
import * as orgMemberModel from "../models/org-members.js"
import * as projectMemberModel from "../models/project-members.js"
import * as roleModel from "../models/roles.js"
import * as userModel from "../models/users.js"
import db from "../config/database.js"

/** Standard UUID v4 format validation pattern */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Default invitation expiry: 7 days from creation */
const INVITATION_EXPIRY_DAYS = 7

/**
 * Joi schema for validating org-level invitation request bodies.
 * Exactly one of username or email must be provided (xor).
 */
const orgInviteSchema = joi
  .object({
    username: joi.string().min(3).max(30).optional(),
    email: joi.string().email().max(255).optional(),
    role_id: joi.string().uuid().required(),
  })
  .xor("username", "email")
  .options({ stripUnknown: true })

/**
 * Joi schema for validating project-level invitation request bodies.
 * Same structure as org invitations — exactly one of username or email required.
 */
const projectInviteSchema = joi
  .object({
    username: joi.string().min(3).max(30).optional(),
    email: joi.string().email().max(255).optional(),
    role_id: joi.string().uuid().required(),
  })
  .xor("username", "email")
  .options({ stripUnknown: true })

/**
 * Resolves the invitee user from either a username or email lookup.
 * Returns { inviteeId, inviteeEmail } — inviteeId may be null if the user
 * doesn't have an account yet (email-only invitation).
 *
 * @param {string} [username] - Invitee's username (mutually exclusive with email)
 * @param {string} [email] - Invitee's email address (mutually exclusive with username)
 * @returns {Promise<{ inviteeId: string|null, inviteeEmail: string|null }>}
 */
const resolveInvitee = async (username, email) => {
  if (username) {
    // Look up by username — user must exist
    const user = await userModel.findOne({ username })
    if (!user) {
      throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "User not found")
    }
    return { inviteeId: user.id, inviteeEmail: user.email }
  }

  // Look up by email — user may or may not exist
  const user = await userModel.findOne({ email })
  return { inviteeId: user?.id ?? null, inviteeEmail: email }
}

/**
 * POST /api/orgs/:org_id/invitations — Create an org-level invitation.
 *
 * Generates a secure random token and sets a 7-day expiry.
 * Validates that the invitee isn't already an org member and that
 * the specified role belongs to this organization.
 *
 * @param {Object} req - Express request object (req.org.id, req.user.id set by middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const createOrgInvitation = async (req, res, next) => {
  try {
    const { error, value } = orgInviteSchema.validate(req.body)
    if (error) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message)
    }

    const { username, email, role_id: roleId } = value

    // Verify the role belongs to this organization
    const role = await roleModel.findOne({ id: roleId, org_id: req.org.id })
    if (!role) {
      throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "Role not found in this organization")
    }

    // Resolve the invitee (by username or email)
    const { inviteeId, inviteeEmail } = await resolveInvitee(username, email)

    // Check the invitee isn't already an org member
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

    // Generate a secure invitation token and set expiry
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

    return res.status(HTTP_STATUS_CODE.CREATED).json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.CREATED,
        data: invitation,
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
    const { error, value } = projectInviteSchema.validate(req.body)
    if (error) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message)
    }

    const { username, email, role_id: roleId } = value

    // Verify the role belongs to this organization
    const role = await roleModel.findOne({ id: roleId, org_id: req.org.id })
    if (!role) {
      throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "Role not found in this organization")
    }

    // Resolve the invitee (by username or email)
    const { inviteeId, inviteeEmail } = await resolveInvitee(username, email)

    // Check the invitee isn't already a project member
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

    // Generate a secure invitation token and set expiry
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

    return res.status(HTTP_STATUS_CODE.CREATED).json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.CREATED,
        data: invitation,
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * GET /api/orgs/:org_id/invitations — List all invitations for an organization.
 * Returns invitations enriched with inviter/invitee usernames and role names.
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
 * POST /api/invitations/:invitation_id/accept — Accept a pending invitation.
 *
 * Validates the invitation belongs to the authenticated user, is still pending,
 * and hasn't expired. Uses a transaction to atomically:
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
    // Validate the :invitation_id route parameter
    const invitationId = req.params.invitation_id
    if (!UUID_REGEX.test(invitationId)) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "Invalid invitation ID format")
    }

    // Transaction: fetch invitation with row lock, validate, then create membership(s)
    await db.transaction(async (trx) => {
      // Lock the invitation row to prevent concurrent acceptance (TOCTOU)
      const invitation = await trx("invitations").where({ id: invitationId }).forUpdate().first()

      if (!invitation) {
        throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "Invitation not found")
      }

      // Verify the invitation belongs to the authenticated user
      if (invitation.invitee_id !== req.user.id) {
        throw new HttpError(HTTP_STATUS_CODE.FORBIDDEN, "This invitation does not belong to you")
      }

      // Verify the invitation is still pending
      if (invitation.status !== "pending") {
        throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "Invitation is no longer pending")
      }

      // Verify the invitation hasn't expired
      if (new Date(invitation.expires_at) < new Date()) {
        throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "Invitation has expired")
      }

      if (invitation.project_id) {
        // --- Project-level invitation ---
        // Auto-add to org as viewer if not already a member
        const orgMembership = await trx("org_members")
          .where({ user_id: req.user.id, org_id: invitation.org_id })
          .first()

        if (!orgMembership) {
          // Find the viewer role for this organization
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

        // Add as project member with the invited role
        await trx("project_members").insert({
          user_id: req.user.id,
          project_id: invitation.project_id,
          role_id: invitation.role_id,
        })
      } else {
        // --- Org-level invitation ---
        await trx("org_members").insert({
          user_id: req.user.id,
          org_id: invitation.org_id,
          role_id: invitation.role_id,
        })
      }

      // Mark the invitation as accepted
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
 * Validates the invitation belongs to the authenticated user and is still pending.
 * Marks the invitation status as "declined".
 *
 * @param {Object} req - Express request object (req.user.id set by auth middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const declineInvitation = async (req, res, next) => {
  try {
    // Validate the :invitation_id route parameter
    const invitationId = req.params.invitation_id
    if (!UUID_REGEX.test(invitationId)) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "Invalid invitation ID format")
    }

    const invitation = await invitationModel.findOne({ id: invitationId })
    if (!invitation) {
      throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "Invitation not found")
    }

    // Verify the invitation belongs to the authenticated user
    if (invitation.invitee_id !== req.user.id) {
      throw new HttpError(HTTP_STATUS_CODE.FORBIDDEN, "This invitation does not belong to you")
    }

    // Verify the invitation is still pending
    if (invitation.status !== "pending") {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "Invitation is no longer pending")
    }

    // Mark the invitation as declined
    await invitationModel.update(
      { id: invitationId },
      { status: "declined", updated_at: new Date() },
    )

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
    // Validate the :invitation_id route parameter
    const invitationId = req.params.invitation_id
    if (!UUID_REGEX.test(invitationId)) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "Invalid invitation ID format")
    }

    // Verify the invitation exists and belongs to this org
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
