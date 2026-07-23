import { createParamDecorator, ExecutionContext } from "@nestjs/common"
export const CurrentProject = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<{ project?: { id: string } }>().project
})
