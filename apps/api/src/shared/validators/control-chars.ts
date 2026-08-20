import { applyDecorators } from "@nestjs/common"
import { ApiProperty } from "@nestjs/swagger"
import { Transform } from "class-transformer"
import { Matches } from "class-validator"

/**
 * Rejects a string that holds a control character, a line or paragraph separator, or a
 * bidirectional override. An override lets one name render as another, so a display name
 * that carries one can impersonate a different organisation.
 *
 * The rule rejects the newline too, so it suits a single-line name or title only. A
 * multi-line `description` field must not use it.
 */
export const CONTROL_CHARS =
  /^[^\p{Cc}\p{Zl}\p{Zp}\u200e\u200f\u202a-\u202e\u2066-\u2069]+$/u

/**
 * Applies the control-character rule and trims the value. Put it on every single-line
 * free-text field that the SPA renders.
 *
 * The explicit `ApiProperty` is load-bearing. The `@nestjs/swagger` CLI plugin is a
 * compile-time AST transformer: it reads decorators it can see in the DTO source, and it
 * cannot see through `applyDecorators`. Without this call the constraint disappears from
 * `/api/docs`, and a generated client accepts a body that the API rejects with a 400.
 *
 * The rule goes in `description`, not in `pattern`. The regex needs the `u` flag for its
 * `\p{...}` classes, and a client generator that compiles the pattern as plain ECMA-262
 * fails on it.
 */
export function IsPlainSingleLine(): PropertyDecorator {
  return applyDecorators(
    Matches(CONTROL_CHARS, { message: "$property must not contain control characters" }),
    Transform(({ value }) => (typeof value === "string" ? value.trim() : value)),
    ApiProperty({
      description:
        "Leading and trailing spaces are removed. The value must not contain a control " +
        "character, a line or paragraph separator, or a bidirectional override.",
    }),
  )
}
