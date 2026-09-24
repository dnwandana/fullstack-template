import { z } from "zod"

const IDS_MESSAGE = "ids must be 1-50 comma-separated valid UUIDs"

export const bulkDeleteSchema = z.strictObject({
  // `?ids=a,b` arrives as one string. A repeated key (`?ids=a&ids=b`) arrives as an array and
  // passes through.
  ids: z.preprocess(
    (value) =>
      typeof value === "string"
        ? value
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
        : value,
    // z.uuid() is the rule of the shared `uuid` field, called here to attach the one message.
    z.array(z.uuid(IDS_MESSAGE), { error: IDS_MESSAGE }).min(1, IDS_MESSAGE).max(50, IDS_MESSAGE),
  ),
})

export type BulkDeleteDto = z.infer<typeof bulkDeleteSchema>
