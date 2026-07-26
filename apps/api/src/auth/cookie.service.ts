import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Response } from "express"
import { parseDuration } from "../common/duration"

@Injectable()
export class CookieService {
  constructor(private readonly config: ConfigService) {}

  private get secure(): boolean {
    return this.config.get<string>("NODE_ENV") === "production"
  }

  private maxAge(key: "ACCESS_TOKEN_EXPIRES_IN" | "REFRESH_TOKEN_EXPIRES_IN"): number {
    // Same source of truth as the JWT and the refresh_tokens row. A hardcoded value
    // here would expire the cookie out from under a still-valid token.
    // parseDuration returns milliseconds, which is exactly the unit res.cookie wants.
    return parseDuration(this.config.get<string>(key) as string)
  }

  setAccess(res: Response, token: string): void {
    res.cookie("access_token", token, {
      httpOnly: true,
      secure: this.secure,
      sameSite: "strict",
      path: "/api",
      maxAge: this.maxAge("ACCESS_TOKEN_EXPIRES_IN"),
    })
  }

  setRefresh(res: Response, token: string): void {
    res.cookie("refresh_token", token, {
      httpOnly: true,
      secure: this.secure,
      sameSite: "strict",
      path: "/api/auth",
      maxAge: this.maxAge("REFRESH_TOKEN_EXPIRES_IN"),
    })
  }

  clear(res: Response): void {
    // maxAge 0 is an expiry instruction, not a lifetime — never derived from config.
    const base = { httpOnly: true, secure: this.secure, sameSite: "strict" as const, maxAge: 0 }
    res.cookie("access_token", "", { ...base, path: "/api" })
    res.cookie("refresh_token", "", { ...base, path: "/api/auth" })
  }
}
