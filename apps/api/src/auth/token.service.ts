import { Injectable } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { ConfigService } from "@nestjs/config"
import { randomUUID } from "crypto"

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
        expiresIn: this.config.get<string>("ACCESS_TOKEN_EXPIRES_IN") as never,
        issuer: this.issuer,
        audience: this.audience,
      },
    )
  }

  signRefresh(id: string): Promise<string> {
    return this.jwt.signAsync(
      { id, type: "refresh", jti: randomUUID() },
      {
        secret: this.config.get<string>("REFRESH_TOKEN_SECRET"),
        algorithm: "HS256",
        expiresIn: this.config.get<string>("REFRESH_TOKEN_EXPIRES_IN") as never,
        issuer: this.issuer,
        audience: this.audience,
      },
    )
  }

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
