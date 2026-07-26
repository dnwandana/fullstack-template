import { Module, ValidationPipe } from "@nestjs/common"
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core"
import { ConfigModule, ConfigService } from "@nestjs/config"
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
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: "general",
          ttl: 15 * 60 * 1000,
          // Read through ConfigService, not process.env: the factory runs after
          // ConfigModule validation, so Joi's coercion and default apply by
          // construction. The previous inline `Number(process.env.X ?? 100)` only
          // saw them because ConfigModule.forRoot happens to be evaluated earlier in
          // this same imports array — reordering it would have silently produced NaN,
          // and a NaN limit disables throttling with no error anywhere.
          limit: config.get<number>("RATE_LIMIT_GENERAL_MAX") as number,
        },
      ],
    }),
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
