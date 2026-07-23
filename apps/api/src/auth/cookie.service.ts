import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Response } from "express"

const ACCESS_MAX_AGE = 15 * 60 * 1000
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000

@Injectable()
export class CookieService {
  constructor(private readonly config: ConfigService) {}

  private get secure(): boolean {
    return this.config.get<string>("NODE_ENV") === "production"
  }

  setAccess(res: Response, token: string): void {
    res.cookie("access_token", token, {
      httpOnly: true,
      secure: this.secure,
      sameSite: "strict",
      path: "/api",
      maxAge: ACCESS_MAX_AGE,
    })
  }

  setRefresh(res: Response, token: string): void {
    res.cookie("refresh_token", token, {
      httpOnly: true,
      secure: this.secure,
      sameSite: "strict",
      path: "/api/auth",
      maxAge: REFRESH_MAX_AGE,
    })
  }

  clear(res: Response): void {
    const base = { httpOnly: true, secure: this.secure, sameSite: "strict" as const, maxAge: 0 }
    res.cookie("access_token", "", { ...base, path: "/api" })
    res.cookie("refresh_token", "", { ...base, path: "/api/auth" })
  }
}
