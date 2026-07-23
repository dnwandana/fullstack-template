import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from "@nestjs/common"
import { Throttle } from "@nestjs/throttler"
import { Request, Response } from "express"
import { AuthService } from "./auth.service"
import { SignupDto } from "./dto/signup.dto"
import { SigninDto } from "./dto/signin.dto"
import { Public } from "../common/decorators/public.decorator"
import { CurrentUser } from "../common/decorators/current-user.decorator"
import { RefreshTokenGuard } from "./guards/refresh-token.guard"

// Override the global "general" throttler with the stricter auth limit
// (RATE_LIMIT_AUTH_MAX, default 10/15min) for every route in this controller.
@Throttle({
  general: { limit: Number(process.env.RATE_LIMIT_AUTH_MAX ?? 10), ttl: 15 * 60 * 1000 },
})
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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
    const data = await this.auth.signin(dto, res)
    return { message: "OK", data }
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
    const data = await this.auth.refresh(userId, req.cookies?.refresh_token as string, res)
    return { message: "OK", data }
  }

  @Public()
  @UseGuards(RefreshTokenGuard)
  @Post("logout")
  @HttpCode(200)
  async logout(
    @Req() req: Request & { cookies?: Record<string, string> },
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.auth.logout(req.cookies?.refresh_token, res)
    return { message: "OK", data }
  }

  @Get("me")
  async me(@CurrentUser("id") userId: string) {
    const data = await this.auth.me(userId)
    return { message: "OK", data }
  }
}
