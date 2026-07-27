import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { Request } from "express"
import { PERMISSION_KEY } from "@shared/decorators/require-permission.decorator"

/** Enforces `@RequirePermission` against `req.permissions`, set by the tenant guards before it. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /** Passes a handler with no `@RequirePermission`; else throws 403 unless the name is held. */
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required) return true

    const req = context.switchToHttp().getRequest<Request & { permissions?: string[] }>()
    if (!req.permissions?.includes(required)) {
      throw new ForbiddenException("You do not have permission to perform this action")
    }
    return true
  }
}
