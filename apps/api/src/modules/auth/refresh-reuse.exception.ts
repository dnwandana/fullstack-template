import { UnauthorizedException } from "@nestjs/common"

// Thrown when a revoked refresh token is replayed. Distinct class so the
// controller can clear auth cookies on exactly this path — the service no
// longer touches the Response (L-3).
export class RefreshReuseException extends UnauthorizedException {
  constructor() {
    super("Invalid refresh token")
  }
}
