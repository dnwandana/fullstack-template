import { Global, Module } from "@nestjs/common"
import { BullModule } from "@nestjs/bullmq"
import type Redis from "ioredis"
import { REDIS_CLIENT } from "@core/redis/redis.constants"
import { NOTIFICATION_QUEUE } from "./queue.constants"
import { NotificationProcessor } from "./notification.processor"

// @Global() for the same reason RedisModule is: registerQueue() below creates the
// Queue provider under getQueueToken(NOTIFICATION_QUEUE), and importing that
// dynamic module a second time from AuthModule and InvitationsModule would build a
// second and third Queue object over the same Redis keys. One registration,
// exported globally, is one Queue.
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [REDIS_CLIENT],
      // Reuse the 09a client rather than letting BullMQ open its own from a URL.
      // This is why RedisModule sets maxRetriesPerRequest: null — BullMQ's blocking
      // consumer connection throws on any finite value. BullMQ duplicates this
      // client for the worker's blocking reads and leaves the original for
      // RedisModule's onApplicationShutdown to close.
      useFactory: (redis: Redis) => ({ connection: redis }),
    }),
    BullModule.registerQueue({
      name: NOTIFICATION_QUEUE,
      // Set explicitly: BullMQ's own defaults are one attempt, no backoff, and
      // unbounded retention, none of which are what this queue wants.
      defaultJobOptions: {
        // Without `attempts` a job that throws once is failed permanently, while the
        // caller was already answered 200. A transient mail-provider outage would
        // then drop the notification silently — strictly worse than the synchronous
        // call this replaced, which at least surfaced the error to the request.
        attempts: 3,
        // Exponential, not fixed: a provider that is rate-limiting or restarting is
        // made worse by three retries a second apart. Gaps are ~1s, ~2s, ~4s.
        backoff: { type: "exponential", delay: 1000 },
        // Completed and failed jobs are Redis hashes that live forever unless bounded.
        // A log-only seam produces one per password reset and one per invitation, so
        // without these the keyspace grows without limit for data nobody reads. Failed
        // jobs are kept 5x longer than completed ones because they are the ones worth
        // inspecting after an incident.
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),
  ],
  providers: [NotificationProcessor],
  exports: [BullModule],
})
export class QueueModule {}
