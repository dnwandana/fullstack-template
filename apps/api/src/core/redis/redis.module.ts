import { Global, Inject, Logger, Module, type OnApplicationShutdown } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import Redis from "ioredis"
import { REDIS_CLIENT } from "./redis.constants"

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        // maxRetriesPerRequest: null is required by BullMQ (09c) — with a finite
        // value its blocking consumer connection throws once the count is hit.
        // lazyConnect is left at its ioredis default of false — deliberately, not
        // by omission: the socket opens on construction, so an unreachable Redis
        // starts complaining at boot rather than on the first job. Note this makes
        // the failure loud, not fatal; ioredis reconnects forever, so the process
        // still boots and serves. /health/ready is what has to reject it.
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

  // Without this the open ioredis socket keeps Jest alive after every
  // integration suite and the run never exits.
  async onApplicationShutdown(): Promise<void> {
    await this.client.quit()
  }
}
