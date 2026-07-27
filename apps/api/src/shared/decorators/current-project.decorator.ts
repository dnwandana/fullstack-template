import { createParamDecorator, ExecutionContext } from "@nestjs/common"
/** Read `req.project` — `undefined` unless `@ProjectScoped` ran `ProjectGuard` first. */
export const CurrentProject = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<{ project?: { id: string } }>().project
})
