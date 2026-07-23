import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Response } from "express"
import { UsersService } from "../users/users.service"
import { InvitationsService } from "../invitations/invitations.service"
import { PasswordService } from "./password.service"
import { TokenService } from "./token.service"
import { RefreshTokenService } from "./refresh-token.service"
import { CookieService } from "./cookie.service"
import { SignupDto } from "./dto/signup.dto"
import { SigninDto } from "./dto/signin.dto"

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000

type SafeUser = { id: string; name: string; email: string }

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly users: UsersService,
    private readonly invitations: InvitationsService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly cookies: CookieService,
    private readonly config: ConfigService,
  ) {}

  async signup(dto: SignupDto): Promise<SafeUser> {
    const existing = await this.users.findSafeByEmail(dto.email)
    if (existing) throw new BadRequestException("user with the given email already exists")
    try {
      const hashed = await this.passwords.hash(dto.password)
      const created = await this.users.create({
        name: dto.name,
        email: dto.email,
        password: hashed,
      })
      try {
        await this.invitations.linkInviteeByEmail(dto.email, created.id)
      } catch (backfillErr) {
        // best-effort backfill — swallow (matches Express behavior); never turns a
        // successful signup into a 500. Logged so a broken backfill is diagnosable.
        this.logger.warn(
          `invitation backfill failed for user ${created.id}: ${(backfillErr as Error).message}`,
        )
      }
      return created
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") {
        throw new BadRequestException("user with the given email already exists")
      }
      throw err
    }
  }

  async signin(dto: SigninDto, res: Response): Promise<SafeUser> {
    const user = await this.users.findWithPasswordByEmail(dto.email)

    // Always run one Argon2 verify (real or dummy hash) before branching on lock
    // state, so locked / wrong-password / unknown-email paths share one timing
    // profile and can't be distinguished by response latency.
    const hashToVerify = user?.password ?? this.passwords.dummyHash
    const valid = await this.passwords.verify(hashToVerify, dto.password)

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException("invalid credentials")
    }

    if (!user || !valid) {
      if (user) {
        const attempts = await this.users.incrementFailedAttempts(user.id)
        if (attempts >= MAX_FAILED_ATTEMPTS) {
          await this.users.lockAccount(user.id, new Date(Date.now() + LOCKOUT_DURATION_MS))
        }
      }
      throw new UnauthorizedException("invalid credentials")
    }

    await this.users.resetLockout(user.id)
    await this.issueCookies(user.id, res)
    return { id: user.id, name: user.name, email: user.email }
  }

  async refresh(userId: string, rawRefreshToken: string, res: Response): Promise<null> {
    const stored = await this.refreshTokens.findActive(rawRefreshToken)
    if (!stored || stored.userId !== userId) {
      throw new UnauthorizedException("Invalid refresh token")
    }
    if (stored.expiresAt < new Date()) throw new UnauthorizedException("Refresh token has expired")
    const user = await this.users.findSafeById(userId)
    if (!user) throw new UnauthorizedException("invalid credentials")
    await this.refreshTokens.revoke(stored.id)
    await this.issueCookies(userId, res)
    return null
  }

  async logout(rawRefreshToken: string | undefined, res: Response): Promise<null> {
    if (rawRefreshToken) {
      const stored = await this.refreshTokens.findActive(rawRefreshToken)
      if (stored) await this.refreshTokens.revoke(stored.id)
    }
    this.cookies.clear(res)
    return null
  }

  async me(userId: string): Promise<SafeUser> {
    const user = await this.users.findSafeById(userId)
    if (!user) throw new NotFoundException("User not found")
    return user
  }

  private async issueCookies(userId: string, res: Response): Promise<void> {
    const accessToken = await this.tokens.signAccess(userId)
    const refreshToken = await this.tokens.signRefresh(userId)
    const expiresAt = this.refreshTokens.expiryFromDuration(
      this.config.get<string>("REFRESH_TOKEN_EXPIRES_IN") as string,
    )
    await this.refreshTokens.persist(userId, refreshToken, expiresAt)
    this.cookies.setAccess(res, accessToken)
    this.cookies.setRefresh(res, refreshToken)
  }
}
