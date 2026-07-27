import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { UsersService } from "@modules/users/users.service"
import { InvitationsService } from "@modules/invitations/invitations.service"
import { PasswordService } from "./password.service"
import { TokenService } from "./token.service"
import { RefreshTokenService } from "./refresh-token.service"
import { RefreshReuseException } from "./refresh-reuse.exception"
import { SignupDto } from "./dto/signup.dto"
import { SigninDto } from "./dto/signin.dto"

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000

type SafeUser = { id: string; name: string; email: string }

/**
 * Credential and session lifecycle. Refresh-token rotation is one-shot: a refresh that loses the
 * atomic claim is treated as a leak, not a retry, and takes every session for that user with it.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly users: UsersService,
    private readonly invitations: InvitationsService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Creates the user and backfills any pending invitations for the address.
   * Deliberately reveals that an email is taken (L-14): the "if an account exists we've emailed
   * you" reply needs real mail delivery, so do not "fix" this alone — revisit when a mailer lands.
   */
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
        // Best-effort: swallowed (matches Express behaviour) so a broken backfill never turns a
        // successful signup into a 500, but logged so it stays diagnosable.
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

  /**
   * Verifies credentials and issues a token pair, persisting the refresh-token hash.
   * 5 failed attempts lock the account for 15 minutes, and a locked account gets the same
   * "invalid credentials" 401 as a wrong password, so a caller cannot tell the two apart.
   */
  async signin(
    dto: SigninDto,
  ): Promise<{ user: SafeUser; accessToken: string; refreshToken: string }> {
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
    const tokens = await this.issueTokens(user.id)
    return { user: { id: user.id, name: user.name, email: user.email }, ...tokens }
  }

  /**
   * Rotates the presented refresh token. A token that is already revoked, or that loses the
   * atomic claim to a concurrent presenter, is treated as a leak: every refresh token for the
   * user is revoked and `RefreshReuseException` is thrown.
   */
  async refresh(
    userId: string,
    rawRefreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const stored = await this.refreshTokens.findByToken(rawRefreshToken)
    if (!stored || stored.userId !== userId) {
      throw new UnauthorizedException("Invalid refresh token")
    }
    if (stored.revokedAt) {
      // Already rotated: the presenter is replaying a token that should no longer exist anywhere.
      return this.handleReuse(stored.userId)
    }
    if (stored.expiresAt < new Date()) throw new UnauthorizedException("Refresh token has expired")
    const user = await this.users.findSafeById(userId)
    if (!user) throw new UnauthorizedException("invalid credentials")
    // The claim is atomic, so of two concurrent presenters exactly one rotates; the loser is a
    // replay by definition, even though the revokedAt check above saw null.
    const claimed = await this.refreshTokens.claimForRotation(stored.id)
    if (!claimed) return this.handleReuse(stored.userId)
    return this.issueTokens(userId)
  }

  // Assume the replayed token leaked and kill every live session for the user — including the
  // one minted by whoever rotated it. Throws RefreshReuseException so the controller clears the
  // auth cookies on exactly this path.
  private async handleReuse(userId: string): Promise<never> {
    await this.refreshTokens.revokeAllForUser(userId)
    this.logger.warn(`Refresh token reuse detected for user ${userId}`)
    throw new RefreshReuseException()
  }

  /** No-op when the cookie is missing or already revoked, which is what makes logout idempotent. */
  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (rawRefreshToken) {
      const stored = await this.refreshTokens.findActive(rawRefreshToken)
      if (stored) await this.refreshTokens.revoke(stored.id)
    }
  }

  /** Throws `NotFoundException`, not `401`, when the token verified but the user row is gone. */
  async me(userId: string): Promise<SafeUser> {
    const user = await this.users.findSafeById(userId)
    if (!user) throw new NotFoundException("User not found")
    return user
  }

  private async issueTokens(
    userId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await this.tokens.signAccess(userId)
    const refreshToken = await this.tokens.signRefresh(userId)
    const expiresAt = this.refreshTokens.expiryFromDuration(
      this.config.get<string>("REFRESH_TOKEN_EXPIRES_IN") as string,
    )
    await this.refreshTokens.persist(userId, refreshToken, expiresAt)
    return { accessToken, refreshToken }
  }
}
