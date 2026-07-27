import { createParamDecorator, ExecutionContext } from "@nestjs/common"
/** Read `req.org` — `undefined` unless `@OrgScoped`/`@ProjectScoped` ran `OrgGuard` first. */
export const CurrentOrg = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<{ org?: { id: string; role_name: string } }>().org
})
