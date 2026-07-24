import { createParamDecorator, ExecutionContext } from "@nestjs/common"
export const CurrentPermissions = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<{ permissions?: string[] }>().permissions ?? []
})
