import { z } from "zod"
import { paginationQuerySchema } from "@shared/pagination/pagination.dto"
import { uuid } from "@shared/validation/fields"

// A date-only value or a full ISO 8601 date-time, with or without an offset.
const isoInstant = z.union([z.iso.date(), z.iso.datetime({ offset: true, local: true })])

// `page`, `limit`, `sort_order` and `search` come from the parent — do not redeclare them.
export const listAuditLogsSchema = paginationQuerySchema.extend({
  project_id: uuid.optional().meta({ description: "Filter by project id" }),
  actor_id: uuid.optional().meta({ description: "Filter by actor user id" }),
  action: z
    .string()
    .max(50)
    .optional()
    .meta({ description: "Filter by exact action, e.g. todo.created" }),
  entity_type: z
    .string()
    .max(50)
    .optional()
    .meta({ description: "Filter by entity type, e.g. todo" }),
  date_from: isoInstant
    .optional()
    .meta({ description: "Entries at or after this ISO 8601 instant" }),
  date_to: isoInstant
    .optional()
    .meta({ description: "Entries at or before this ISO 8601 instant" }),
})

export type ListAuditLogsDto = z.infer<typeof listAuditLogsSchema>
