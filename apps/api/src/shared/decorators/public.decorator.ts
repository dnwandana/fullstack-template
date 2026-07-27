import { SetMetadata } from "@nestjs/common"

export const IS_PUBLIC_KEY = "isPublic"
/** Exempt a route from `JwtAuthGuard` only — throttling and the tenancy guards still apply. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
