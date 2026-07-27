import { UnauthorizedException } from "@nestjs/common"

/**
 * Thrown when a revoked refresh token is replayed. A distinct class so the controller can clear
 * the auth cookies on exactly this path — the service no longer touches the Response (L-3).
 */
export class RefreshReuseException extends UnauthorizedException {
  constructor() {
    super("Invalid refresh token")
  }
}
