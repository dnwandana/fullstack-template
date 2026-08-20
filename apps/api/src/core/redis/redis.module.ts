import { Global, Inject, Logger, Module, type OnApplicationShutdown } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import Redis from "ioredis"
import { REDIS_CLIENT } from "./redis.constants"

// @Global() so one client serves the whole app: BullMQ and the throttler storage both take this
// provider, and a second import would open a second socket to the same Redis.
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        // maxRetriesPerRequest: null is required by BullMQ — with a finite value its blocking
        // consumer throws. lazyConnect stays at ioredis' default false deliberately, so an
        // unreachable Redis complains at boot. It then retries forever, and /health/ready does
        // NOT probe Redis, so the instance reports ready and serves traffic. The queue writes
        // and the rate-limit writes do not fail fast. enableOfflineQueue is at its default true,
        // so ioredis buffers each command. The awaiting request hangs instead of getting an
        // error. Both AGENTS.md files record this gap.
        const client = new Redis(config.getOrThrow<string>("REDIS_URL"), {
          maxRetriesPerRequest: null,
        })
        const logger = new Logger("Redis")
        client.on("error", (err: Error) => logger.error(err.message))
        return client
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  // Closes the client BullMQ duplicated from. Without it the open ioredis socket keeps Jest
  // alive after every integration suite and the run never exits.
  async onApplicationShutdown(): Promise<void> {
    await this.client.quit()
  }
}
