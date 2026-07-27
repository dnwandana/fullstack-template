import { Module } from "@nestjs/common"
import { JwtModule } from "@nestjs/jwt"
import { UsersModule } from "@modules/users/users.module"
import { InvitationsModule } from "@modules/invitations/invitations.module"
import { AuthService } from "./auth.service"
import { AuthController } from "./auth.controller"
import { PasswordService } from "./password.service"
import { TokenService } from "./token.service"
import { RefreshTokenService } from "./refresh-token.service"
import { CookieService } from "./cookie.service"
import { PasswordResetService } from "./password-reset.service"
import { PasswordResetNotifierService } from "./password-reset-notifier.service"
import { RefreshTokenGuard } from "./guards/refresh-token.guard"

@Module({
  imports: [UsersModule, InvitationsModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    RefreshTokenService,
    CookieService,
    PasswordResetService,
    PasswordResetNotifierService,
    RefreshTokenGuard,
  ],
  exports: [TokenService],
})
export class AuthModule {}
