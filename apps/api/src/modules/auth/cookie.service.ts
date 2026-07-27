import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Response } from "express"
import { parseDuration } from "@shared/utils/duration"
import { ACCESS_COOKIE_PATH, REFRESH_COOKIE_PATH } from "@core/config/api-version"

/**
 * Writes the auth cookies. `SameSite=Strict` is deliberate (L-24) and requires the SPA and API to
 * share a registrable domain — splitting them silently breaks auth, and changing it means editing
 * this file, not an env var. `Secure` is set in production only.
 */
@Injectable()
export class CookieService {
  constructor(private readonly config: ConfigService) {}

  private get secure(): boolean {
    return this.config.get<string>("NODE_ENV") === "production"
  }

  private maxAge(key: "ACCESS_TOKEN_EXPIRES_IN" | "REFRESH_TOKEN_EXPIRES_IN"): number {
    // Same source of truth as the JWT and the refresh_tokens row: hardcoding would expire the
    // cookie out from under a still-valid token. parseDuration returns ms, as res.cookie wants.
    return parseDuration(this.config.get<string>(key) as string)
  }

  setAccess(res: Response, token: string): void {
    res.cookie("access_token", token, {
      httpOnly: true,
      secure: this.secure,
      sameSite: "strict",
      path: ACCESS_COOKIE_PATH,
      maxAge: this.maxAge("ACCESS_TOKEN_EXPIRES_IN"),
    })
  }

  setRefresh(res: Response, token: string): void {
    res.cookie("refresh_token", token, {
      httpOnly: true,
      secure: this.secure,
      sameSite: "strict",
      path: REFRESH_COOKIE_PATH,
      maxAge: this.maxAge("REFRESH_TOKEN_EXPIRES_IN"),
    })
  }

  /** Expires both cookies on the paths they were set on; a mismatched path clears nothing. */
  clear(res: Response): void {
    // maxAge 0 is an expiry instruction, not a lifetime — never derived from config.
    const base = { httpOnly: true, secure: this.secure, sameSite: "strict" as const, maxAge: 0 }
    res.cookie("access_token", "", { ...base, path: ACCESS_COOKIE_PATH })
    res.cookie("refresh_token", "", { ...base, path: REFRESH_COOKIE_PATH })
  }
}
