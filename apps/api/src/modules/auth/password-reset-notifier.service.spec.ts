import { Logger } from "@nestjs/common"
import type { Queue } from "bullmq"
import type { NotificationJob } from "@core/queue/notification.job"
import { PasswordResetNotifierService } from "./password-reset-notifier.service"

// The two assertions this suite used to make — "the always-on line names the user
// id, not the address" and "the reset URL is logged only in development" — moved to
// src/core/queue/notification.processor.spec.ts along with the code that logs.
// What is left to prove here is the property the move created: the service hands the
// processor a payload complete enough to reproduce those lines, and it does not
// resolve until the job is actually on the queue.

function stubQueue(add: jest.Mock): Queue<NotificationJob> {
  return { add } as unknown as Queue<NotificationJob>
}

const params = {
  email: "somebody@example.com",
  rawToken: "a".repeat(64),
  userId: "11111111-2222-3333-4444-555555555555",
}

describe("PasswordResetNotifierService", () => {
  it("enqueues a password-reset job carrying every field the processor logs from", async () => {
    const add = jest.fn().mockResolvedValue({ id: "1" })
    await new PasswordResetNotifierService(stubQueue(add)).sendResetEmail(params)

    expect(add).toHaveBeenCalledTimes(1)
    expect(add).toHaveBeenCalledWith("password-reset", {
      kind: "password-reset",
      email: "somebody@example.com",
      rawToken: "a".repeat(64),
      userId: "11111111-2222-3333-4444-555555555555",
    })
  })

  // The PII rule still binds this layer, it just binds it differently: the service
  // no longer logs at all, so neither the address nor the token can leak from here.
  it("logs nothing itself — the address and the token only travel in the payload", async () => {
    const log = jest.spyOn(Logger.prototype, "log").mockImplementation()
    const debug = jest.spyOn(Logger.prototype, "debug").mockImplementation()

    await new PasswordResetNotifierService(
      stubQueue(jest.fn().mockResolvedValue({})),
    ).sendResetEmail(params)

    expect(log).not.toHaveBeenCalled()
    expect(debug).not.toHaveBeenCalled()
    jest.restoreAllMocks()
  })

  // The call sites await this. If a Redis outage were swallowed here, forgot-password
  // would answer 200 for a reset email that was never queued anywhere.
  it("rejects when the queue rejects rather than resolving on a dropped job", async () => {
    const add = jest.fn().mockRejectedValue(new Error("redis unreachable"))
    await expect(
      new PasswordResetNotifierService(stubQueue(add)).sendResetEmail(params),
    ).rejects.toThrow("redis unreachable")
  })
})
