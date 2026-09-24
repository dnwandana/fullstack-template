import { z } from "zod"
import { hexToken } from "@shared/validation/fields"

export const previewQuerySchema = z.strictObject({ token: hexToken })

export type PreviewQueryDto = z.infer<typeof previewQuerySchema>
