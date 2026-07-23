import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { Request } from "express"
import { IS_PUBLIC_KEY } from "../../common/decorators/public.decorator"
import { TokenService } from "../token.service"

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: { id: string }; cookies?: Record<string, string> }>()
    const token = req.cookies?.access_token
    if (!token) throw new UnauthorizedException("No token provided")

    try {
      const decoded = await this.tokens.verifyAccess(token)
      if (decoded.type !== "access") throw new UnauthorizedException("Invalid token type")
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
