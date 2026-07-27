import { Global, Module } from "@nestjs/common"
import { BullModule } from "@nestjs/bullmq"
import type Redis from "ioredis"
import { REDIS_CLIENT } from "@core/redis/redis.constants"
import { NOTIFICATION_QUEUE } from "./queue.constants"
import { NotificationProcessor } from "./notification.processor"

// One Queue per app: importing this dynamic module twice would build a second
// Queue over the same Redis keys, so it is @Global() and registered once.
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [REDIS_CLIENT],
      // Reuse RedisModule's client instead of letting BullMQ open its own from a URL — that
      // is why that module sets maxRetriesPerRequest: null, which BullMQ's blocking consumer
      // requires. BullMQ duplicates it; RedisModule's shutdown hook closes the original.
      useFactory: (redis: Redis) => ({ connection: redis }),
    }),
    BullModule.registerQueue({
      name: NOTIFICATION_QUEUE,
      // BullMQ defaults to one attempt, no backoff and unbounded retention. The caller already
      // got a 200, so an un-retried throw drops the notification silently; backoff is
      // exponential (~1s/2s/4s) so retries do not pile onto a restarting provider.
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        // Completed and failed job hashes live in Redis forever unless bounded. Failed are
        // kept 5x longer than completed: they are the ones worth inspecting after an incident.
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),
  ],
  providers: [NotificationProcessor],
  exports: [BullModule],
})
export class QueueModule {}
