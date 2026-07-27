import { createParamDecorator, ExecutionContext } from "@nestjs/common"

export interface AuthUser {
  id: string
}

/**
 * Read `req.user`, or one field of it with `@CurrentUser("id")`. Both `JwtAuthGuard` and
 * `RefreshTokenGuard` set it, so it is `undefined` only on a route neither guard ran on.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>()
    const user = request.user
    return data ? user?.[data] : user
  },
)
