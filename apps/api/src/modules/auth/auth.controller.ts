import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from "@nestjs/common"
import { Throttle } from "@nestjs/throttler"
import { Request, Response } from "express"
import { AuthService } from "./auth.service"
import { CookieService } from "./cookie.service"
import { PasswordResetService } from "./password-reset.service"
import { RefreshReuseException } from "./refresh-reuse.exception"
import { SignupDto } from "./dto/signup.dto"
import { SigninDto } from "./dto/signin.dto"
import { ForgotPasswordDto } from "./dto/forgot-password.dto"
import { ResetPasswordDto } from "./dto/reset-password.dto"
import { Public } from "@shared/decorators/public.decorator"
import { CurrentUser } from "@shared/decorators/current-user.decorator"
import { RefreshTokenGuard } from "./guards/refresh-token.guard"
import { authThrottleLimit } from "@core/config/auth-throttle"

/**
 * `refresh` and `logout` are `@Public()` with respect to `JwtAuthGuard` but gated by
 * `RefreshTokenGuard`, so they authenticate off the refresh cookie, not the access cookie.
 */

// Narrows the global "general" throttler to RATE_LIMIT_AUTH_MAX (default 10/15min) for every
// route here. authThrottleLimit() reads process.env because decorator arguments run before the
// DI container and Joi exist; it mirrors Joi's constraints and throws at import time.
@Throttle({
  general: { limit: authThrottleLimit(), ttl: 15 * 60 * 1000 },
})
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: CookieService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  @Public()
  @Post("signup")
  async signup(@Body() dto: SignupDto) {
    const data = await this.auth.signup(dto)
    return { message: "Created", data }
  }

  @Public()
  @Post("signin")
  @HttpCode(200)
  async signin(@Body() dto: SigninDto, @Res({ passthrough: true }) res: Response) {
    const { user, accessToken, refreshToken } = await this.auth.signin(dto)
    this.cookies.setAccess(res, accessToken)
    this.cookies.setRefresh(res, refreshToken)
    return { message: "OK", data: user }
  }

  @Public()
  @Post("forgot-password")
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.passwordReset.issue(dto.email)
    // Always the same reply: branching on whether the address exists would turn this endpoint
    // into an account-enumeration oracle.
    return {
      message: "If an account exists for that address, a reset link has been sent",
      data: null,
    }
  }

  @Public()
  @Post("reset-password")
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.passwordReset.consume(dto.token, dto.password)
    return { message: "OK", data: null }
  }

  @Public()
  @UseGuards(RefreshTokenGuard)
  @Post("refresh")
  @HttpCode(200)
  async refresh(
    @CurrentUser("id") userId: string,
    @Req() req: Request & { cookies?: Record<string, string> },
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const { accessToken, refreshToken } = await this.auth.refresh(
        userId,
        req.cookies?.refresh_token as string,
      )
      this.cookies.setAccess(res, accessToken)
      this.cookies.setRefresh(res, refreshToken)
      return { message: "OK", data: null }
    } catch (err) {
      // Reuse of a rotated token nukes the session family server-side; clear the
      // client's cookies too. A plain-invalid refresh (401) leaves cookies alone.
      if (err instanceof RefreshReuseException) this.cookies.clear(res)
      throw err
    }
  }

  @Public()
  @UseGuards(RefreshTokenGuard)
  @Post("logout")
  @HttpCode(200)
  async logout(
    @Req() req: Request & { cookies?: Record<string, string> },
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(req.cookies?.refresh_token)
    this.cookies.clear(res)
    return { message: "OK", data: null }
  }

  @Get("me")
  async me(@CurrentUser("id") userId: string) {
    const data = await this.auth.me(userId)
    return { message: "OK", data }
  }
}
