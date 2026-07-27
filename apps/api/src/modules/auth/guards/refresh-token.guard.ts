import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common"
import { Request } from "express"
import { TokenService } from "../token.service"

/**
 * A second authentication path alongside `JwtAuthGuard`, applied by hand to the `@Public()`
 * refresh and logout routes. It verifies the `refresh_token` cookie and *also* sets `req.user`,
 * so any code reading `req.user` must account for both origins.
 */
@Injectable()
export class RefreshTokenGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  /** Rejects a token whose `type` claim is not `"refresh"`, so an access token cannot be spent. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: { id: string }; cookies?: Record<string, string> }>()
    const token = req.cookies?.refresh_token
    if (!token) throw new UnauthorizedException("No token provided")

    try {
      const decoded = await this.tokens.verifyRefresh(token)
      if (decoded.type !== "refresh") throw new UnauthorizedException("Invalid token type")
      req.user = { id: decoded.id }
      return true
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err
      const name = (err as { name?: string })?.name
      if (name === "TokenExpiredError") throw new UnauthorizedException("Token expired")
      throw new UnauthorizedException("Invalid token")
    }
  }
}
