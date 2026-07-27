import { Injectable } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { ConfigService } from "@nestjs/config"
import { randomUUID } from "crypto"

// Mirrors the Joi grammar (/^\d+[smhd]$/) for *_TOKEN_EXPIRES_IN — a strict subset of the `ms`
// StringValue union jsonwebtoken accepts for `expiresIn`. (`ms` is a transitive dep whose types
// are not resolvable here.)
type Duration = `${number}${"s" | "m" | "h" | "d"}`

/**
 * Signs and verifies the access and refresh JWTs. The algorithm is pinned to HS256 on both sign
 * and verify, and the two token types use different secrets, so an access token cannot be
 * verified as a refresh token.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private get issuer(): string {
    return this.config.get<string>("JWT_ISSUER") as string
  }
  private get audience(): string {
    return this.config.get<string>("JWT_AUDIENCE") as string
  }

  signAccess(id: string): Promise<string> {
    return this.jwt.signAsync(
      { id, type: "access" },
      {
        secret: this.config.get<string>("ACCESS_TOKEN_SECRET"),
        algorithm: "HS256",
        // A narrowing backed by Joi's /^\d+[smhd]$/ validation at boot, not a lie.
        expiresIn: this.config.getOrThrow<string>("ACCESS_TOKEN_EXPIRES_IN") as Duration,
        issuer: this.issuer,
        audience: this.audience,
      },
    )
  }

  /** Carries a fresh `jti`, so two refresh tokens minted for one user are never identical. */
  signRefresh(id: string): Promise<string> {
    return this.jwt.signAsync(
      { id, type: "refresh", jti: randomUUID() },
      {
        secret: this.config.get<string>("REFRESH_TOKEN_SECRET"),
        algorithm: "HS256",
        expiresIn: this.config.getOrThrow<string>("REFRESH_TOKEN_EXPIRES_IN") as Duration,
        issuer: this.issuer,
        audience: this.audience,
      },
    )
  }

  /**
   * Verifies signature, issuer and audience. Neither verify method checks the `type` claim — the
   * guards do that, and a token of the wrong type is otherwise perfectly valid here.
   */
  verifyAccess(token: string): Promise<{ id: string; type: string }> {
    return this.jwt.verifyAsync(token, {
      secret: this.config.get<string>("ACCESS_TOKEN_SECRET"),
      algorithms: ["HS256"],
      issuer: this.issuer,
      audience: this.audience,
    })
  }

  verifyRefresh(token: string): Promise<{ id: string; type: string; jti: string }> {
    return this.jwt.verifyAsync(token, {
      secret: this.config.get<string>("REFRESH_TOKEN_SECRET"),
      algorithms: ["HS256"],
      issuer: this.issuer,
      audience: this.audience,
    })
  }
}
