import {
  ArgumentMetadata,
  BadRequestException,
  StandardSchemaValidationPipe,
  type StandardSchemaValidationPipeOptions,
} from "@nestjs/common"

// Taken from Nest's own signature, so the app needs no direct @standard-schema/spec dependency.
type Issue = Parameters<
  NonNullable<StandardSchemaValidationPipeOptions["exceptionFactory"]>
>[0][number]

/**
 * Turns schema issues into the messages of a 400. A message that already starts with its field
 * name goes out unchanged, so hand-written messages ("token must be …") stay word for word. Every
 * other message gets a "<path>: " prefix, so a Zod default message still names its field.
 * AllExceptionsFilter joins the array with "; ".
 */
export function formatIssues(issues: readonly Issue[]): string[] {
  return issues.map((issue) => {
    const segments = (issue.path ?? []).map((segment) =>
      String(typeof segment === "object" ? segment.key : segment),
    )
    const field = segments[0]
    if (field === undefined || issue.message.startsWith(field)) return issue.message
    return `${segments.join(".")}: ${issue.message}`
  })
}

/**
 * The global APP_PIPE. It validates each `@Body({ schema })` and `@Query({ schema })` parameter
 * and returns the parsed value, so defaults and trims reach the handler.
 *
 * It also refuses a body or query parameter without a schema. The base pipe passes such a
 * parameter through unchecked, so a forgotten `schema` would accept any input without an error.
 */
export class SchemaValidationPipe extends StandardSchemaValidationPipe {
  constructor() {
    super({ exceptionFactory: (issues) => new BadRequestException(formatIssues(issues)) })
  }

  override async transform<T>(value: T, metadata: ArgumentMetadata): Promise<T> {
    if ((metadata.type === "body" || metadata.type === "query") && !metadata.schema) {
      throw new Error(
        `Validation setup failed: a @${metadata.type === "body" ? "Body" : "Query"}() ` +
          "parameter has no schema. Pass { schema } to the decorator.",
      )
    }
    return super.transform(value, metadata)
  }
}
