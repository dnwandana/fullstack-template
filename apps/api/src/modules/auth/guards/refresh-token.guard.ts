import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common"
import { Request } from "express"
import { TokenService } from "../token.service"

@Injectable()
export class RefreshTokenGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

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
