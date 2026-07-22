import logger from "./logger.js"

/**
 * Delivers an invitation to its recipient.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THIS IS THE EMAIL SEAM. The template ships no mail provider on purpose —
 * pick one to suit the deployment (SendGrid, Brevo, Mailgun, SES, SMTP…).
 *
 * To wire a provider, replace the body of this function. Nothing else in the
 * codebase needs to change: controllers only ever call sendInvitationEmail().
 *
 * Example (SMTP via nodemailer):
 *
 *   import nodemailer from "nodemailer"
 *   const transport = nodemailer.createTransport({ host, port, auth })
 *   await transport.sendMail({
 *     to,
 *     from: process.env.MAIL_FROM,
 *     subject: `${inviterName} invited you to ${orgName}`,
 *     html: `<a href="${acceptUrl}">Accept invitation</a>`,
 *   })
 *
 * Once a provider is live, remove `token` and `accept_url` from the create and
 * resend responses in src/controllers/invitations.js — the invitee should be
 * the only party who ever sees the token.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Callers must treat delivery as best-effort: a provider outage must not fail
 * invitation creation, since the invitation row is already committed.
 *
 * `acceptUrl` embeds the raw invitation token, which is a bearer credential —
 * whoever holds it can join the org at the invited role. It must never be
 * written anywhere with a broader audience than the invitee's inbox, and log
 * files are exactly that (shippers, aggregators, backups, support access).
 * Hand it to a mail provider; do not persist it.
 *
 * @param {Object} params - Delivery parameters
 * @param {string} params.to - Invitee email address
 * @param {string} params.acceptUrl - Absolute URL that accepts the invitation
 * @param {string} params.orgName - Organization display name
 * @param {string|null} params.projectName - Project name, or null for org-level
 * @param {string} params.inviterName - Display name of the inviter
 * @param {string} params.roleName - Role granted on acceptance
 * @param {Date} params.expiresAt - When the invitation stops working
 * @returns {Promise<void>}
 */
export const sendInvitationEmail = async ({
  to,
  acceptUrl,
  orgName,
  projectName,
  inviterName,
  roleName,
  expiresAt,
}) => {
  // Warn, not info: "invitations are silently not being delivered" is a
  // condition an operator should see, not a line buried in the info stream.
  // Note the absence of acceptUrl — see the token warning above.
  logger.warn("No mail provider configured — invitation not delivered", {
    to,
    orgName,
    projectName,
    inviterName,
    roleName,
    expiresAt,
  })

  // Surface the link locally, where the log is a developer's terminal rather
  // than a retained artifact. Requires LOG_LEVEL=debug — the default `info`
  // keeps it out of the way, and the create/resend response carries the same
  // URL anyway. Never emitted outside development.
  if (process.env.NODE_ENV === "development") {
    logger.debug("Invitation accept URL (development only)", { to, acceptUrl })
  }
}
