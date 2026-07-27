import { SetMetadata } from "@nestjs/common"
export const PERMISSION_KEY = "permission"
export const RequirePermission = (name: string) => SetMetadata(PERMISSION_KEY, name)
