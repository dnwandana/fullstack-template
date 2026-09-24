import { z } from "zod"

/**
 * Reusable field rules for the request schemas. A DTO combines these and does not repeat a rule,
 * so one change here moves every endpoint that accepts the field.
 *
 * A message that names its field ("token must be …") goes out unchanged. Every other message gets
 * a "<field>: " prefix from the validation pipe (see schema-validation.pipe.ts).
 */

/**
 * Rejects a string that holds a control character, a line or paragraph separator, or a
 * bidirectional override. An override lets one name render as another, so a display name
 * that carries one can impersonate a different organisation.
 *
 * The rule rejects the newline too, so it suits a single-line name or title only. A
 * multi-line `description` field must not use it.
 */
export const CONTROL_CHARS = /^[^\p{Cc}\p{Zl}\p{Zp}\u200e\u200f\u202a-\u202e\u2066-\u2069]+$/u

/**
 * A single-line name or title that the SPA renders: trimmed, then checked against CONTROL_CHARS.
 *
 * The rule uses `refine`, not `regex`, so the `u`-flag pattern stays out of the OpenAPI
 * document. A client generator that compiles the pattern as plain ECMA-262 fails on it.
 */
export const plainSingleLine = (maxLength: number) =>
  z
    .string()
    .trim()
    // `abort` stops the check here, so an empty or long value does not also get the
    // control-character message.
    .min(1, { abort: true })
    .max(maxLength, { abort: true })
    .refine((value) => CONTROL_CHARS.test(value), "must not contain control characters")
    .meta({
      description:
        "Leading and trailing spaces are removed. The value must not contain a control " +
        "character, a line or paragraph separator, or a bidirectional override.",
    })

/** Multi-line free text, so it has no control-character rule. */
export const optionalDescription = z.string().max(5000).optional()

/**
 * Trimmed and lowercased before the check, so the stored address is canonical. `preprocess`
 * keeps `format: "email"` in the OpenAPI document; a `transform` on the string would not.
 */
export const email = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z.email("email must be a valid email").max(255),
)

/** The same pattern as ParseUUIDPipe and UUID_REGEX: RFC 9562 versions 1-8, nil, and max. */
export const uuid = z.uuid()

const TOKEN_MESSAGE = "token must be a 64-character hex string"

/** A raw invitation or password-reset token. A missing token gets the same message. */
export const hexToken = z.string({ error: TOKEN_MESSAGE }).regex(/^[0-9a-f]{64}$/, TOKEN_MESSAGE)

/**
 * The password policy for every endpoint that sets a password. The 8-128 cap is real; the old
 * 72-character ceiling was a bcrypt artifact (L-15), not an Argon2 constraint.
 */
export const newPassword = z
  .string()
  .min(8, "password must be at least 8 characters")
  .max(128, "password must be at most 128 characters")
  .regex(/[A-Z]/, "password must contain at least one uppercase letter")
  .regex(/[a-z]/, "password must contain at least one lowercase letter")
  .regex(/[0-9]/, "password must contain at least one digit")
  .regex(/[^A-Za-z0-9]/, "password must contain at least one special character")

/** The fields that set a new password. Wrap the DTO in `withPasswordConfirmation`. */
export const newPasswordFields = {
  password: newPassword,
  confirmation_password: z.string(),
}

/**
 * Adds the confirmation check to a DTO that spreads `newPasswordFields`. Zod runs the check only
 * when every field has the correct type, so a missing field reports its own error first.
 */
export const withPasswordConfirmation = <
  S extends z.ZodType<{ password: string; confirmation_password: string }>,
>(
  schema: S,
) =>
  schema.refine((dto) => dto.password === dto.confirmation_password, {
    path: ["confirmation_password"],
    message: "confirmation_password must match password",
  })

/**
 * A positive integer from the query string. Query values arrive as strings, so the rule coerces
 * them; a non-numeric value becomes NaN and fails the integer check.
 */
export const queryInt = (defaultValue: number, max?: number) => {
  const base = z.coerce.number().int().min(1)
  return (max === undefined ? base : base.max(max)).default(defaultValue)
}
