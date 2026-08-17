import { Module, ValidationPipe } from "@nestjs/common"
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { LoggerModule } from "nestjs-pino"
import { ScheduleModule } from "@nestjs/schedule"
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler"
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis"
import type Redis from "ioredis"
import { PrismaModule } from "@core/database/prisma.module"
import { RedisModule } from "@core/redis/redis.module"
import { REDIS_CLIENT } from "@core/redis/redis.constants"
import { QueueModule } from "@core/queue/queue.module"
import { AuditModule } from "@core/audit/audit.module"
import { validate } from "@core/config/env.validation"
import { buildPinoHttpOptions } from "@core/config/pino.config"
import { HealthModule } from "@modules/health/health.module"
import { UsersModule } from "@modules/users/users.module"
import { AuthModule } from "@modules/auth/auth.module"
import { PermissionsModule } from "@modules/permissions/permissions.module"
import { OrgsModule } from "@modules/orgs/orgs.module"
import { RolesModule } from "@modules/roles/roles.module"
import { MembersModule } from "@modules/members/members.module"
import { ProjectsModule } from "@modules/projects/projects.module"
import { TodosModule } from "@modules/todos/todos.module"
import { InvitationsModule } from "@modules/invitations/invitations.module"
import { AuditLogsModule } from "@modules/audit-logs/audit-logs.module"
import { MaintenanceModule } from "@modules/maintenance/maintenance.module"
import { JwtAuthGuard } from "@modules/auth/guards/jwt-auth.guard"
import { TransformInterceptor } from "@core/interceptors/transform.interceptor"
import { AllExceptionsFilter } from "@core/filters/all-exceptions.filter"

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ pinoHttp: buildPinoHttpOptions(config) }),
    }),
    // Without forRoot() the @Cron decorator in CleanupService is inert and the job never
    // fires — with no error anywhere.
    ScheduleModule.forRoot(),
    PrismaModule,
    // Redis is a hard dependency, so it joins the graph at boot rather than opening lazily on
    // first use — an unreachable Redis has to surface at startup. @Global(), so consumers inject
    // REDIS_CLIENT without importing this module again.
    RedisModule,
    // Must come after RedisModule: its BullMQ root injects REDIS_CLIENT. @Global(),
    // so the notifier services inject the notifications queue without importing it.
    QueueModule,
    // @Global(), so the mutation services inject AuditService without importing this module.
    AuditModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, REDIS_CLIENT],
      // The object form, not the bare array: an array has nowhere to put `storage`,
      // and an array carrying a stray `storage` key is silently ignored.
      useFactory: (config: ConfigService, redis: Redis) => ({
        // Counters in Redis so the limit belongs to the deployment, not to each process: the
        // default in-memory store gives N replicas N independent counters and an effective limit
        // of N x max — including the auth lockout that exists to slow credential stuffing.
        storage: new ThrottlerStorageRedisService(redis),
        throttlers: [
          {
            name: "general",
            ttl: 15 * 60 * 1000,
            // Via ConfigService, not process.env: the factory runs after ConfigModule validation,
            // so Joi's coercion and default apply by construction. The old inline
            // `Number(process.env.X ?? 100)` yielded NaN on a reorder — throttling silently off.
            limit: config.getOrThrow<number>("RATE_LIMIT_GENERAL_MAX"),
          },
        ],
      }),
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
    AuditLogsModule,
    MaintenanceModule,
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
    // Registration order is a contract: ThrottlerGuard before JwtAuthGuard, so an unauthenticated
    // flood is rate-limited before it reaches token verification.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
