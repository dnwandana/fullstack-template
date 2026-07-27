import { createParamDecorator, ExecutionContext } from "@nestjs/common"
/** Read the merged org + project permissions, defaulting to `[]` when no tenancy guard ran. */
export const CurrentPermissions = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<{ permissions?: string[] }>().permissions ?? []
})
