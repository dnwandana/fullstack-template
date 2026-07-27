import { SetMetadata } from "@nestjs/common"
export const PERMISSION_KEY = "permission"
/**
 * Require one permission for the handler. Inert unless `PermissionsGuard` runs, so apply it under
 * `@OrgScoped`/`@ProjectScoped`; a handler-level name overrides a class-level one.
 */
export const RequirePermission = (name: string) => SetMetadata(PERMISSION_KEY, name)
