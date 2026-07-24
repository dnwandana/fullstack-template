import { Module, ValidationPipe } from "@nestjs/common"
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core"
import { ConfigModule } from "@nestjs/config"
import { LoggerModule } from "nestjs-pino"
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler"
import { PrismaModule } from "./prisma/prisma.module"
import { validate } from "./config/env.validation"
import { buildPinoHttpOptions } from "./config/pino.config"
import { HealthModule } from "./health/health.module"
import { UsersModule } from "./users/users.module"
import { AuthModule } from "./auth/auth.module"
import { PermissionsModule } from "./permissions/permissions.module"
import { OrgsModule } from "./orgs/orgs.module"
import { RolesModule } from "./roles/roles.module"
import { MembersModule } from "./members/members.module"
import { ProjectsModule } from "./projects/projects.module"
import { TodosModule } from "./todos/todos.module"
import { InvitationsModule } from "./invitations/invitations.module"
import { JwtAuthGuard } from "./auth/guards/jwt-auth.guard"
import { TransformInterceptor } from "./common/interceptors/transform.interceptor"
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter"

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    LoggerModule.forRoot({ pinoHttp: buildPinoHttpOptions() }),
    PrismaModule,
    ThrottlerModule.forRoot([
      {
        name: "general",
        ttl: 15 * 60 * 1000,
        limit: Number(process.env.RATE_LIMIT_GENERAL_MAX ?? 100),
      },
    ]),
    HealthModule,
    UsersModule,
    AuthModule,
    PermissionsModule,
    OrgsModule,
    RolesModule,
    MembersModule,
    ProjectsModule,
    TodosModule,
    InvitationsModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
