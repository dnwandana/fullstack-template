import { Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { NotificationProcessor } from "../notification.processor"
import type { NotificationJob } from "../notification.job"

const configOf = (env: string, base = "http://localhost:5173") =>
  ({ get: (k: string) => (k === "NODE_ENV" ? env : base) }) as unknown as ConfigService

const jobOf = (data: NotificationJob) => ({ data }) as { data: NotificationJob }

describe("NotificationProcessor", () => {
  const reset: NotificationJob = {
    kind: "password-reset",
    userId: "u1",
    email: "a@b.c",
    rawToken: "raw-token",
  }

  const invitation: NotificationJob = {
    kind: "invitation",
    invitationId: "i1",
    email: "invitee@example.com",
    rawToken: "invite-token",
    orgName: "Acme Inc",
  }

  it("logs by user id, never by email address", async () => {
    const spy = jest.spyOn(Logger.prototype, "log").mockImplementation()
    await new NotificationProcessor(configOf("production")).process(jobOf(reset))
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("u1"))
    expect(spy).not.toHaveBeenCalledWith(expect.stringContaining("a@b.c"))
    spy.mockRestore()
  })

  it("never emits the raw token outside development", async () => {
    const spy = jest.spyOn(Logger.prototype, "debug").mockImplementation()
    jest.spyOn(Logger.prototype, "log").mockImplementation()
    await new NotificationProcessor(configOf("production")).process(jobOf(reset))
    expect(spy).not.toHaveBeenCalled()
    jest.restoreAllMocks()
  })

  it("emits the reset URL in development", async () => {
    const spy = jest.spyOn(Logger.prototype, "debug").mockImplementation()
    jest.spyOn(Logger.prototype, "log").mockImplementation()
    await new NotificationProcessor(configOf("development")).process(jobOf(reset))
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("raw-token"))
    jest.restoreAllMocks()
  })

  // The invitation line is the one the brief's payload could not reproduce: without
  // `orgName` on the job the "(org: …)" half of the log silently disappears.
  it("keeps the org name in the invitation log line", async () => {
    const spy = jest.spyOn(Logger.prototype, "log").mockImplementation()
    await new NotificationProcessor(configOf("production")).process(jobOf(invitation))
    expect(spy).toHaveBeenCalledWith(
      "Invitation email queued for invitee@example.com (org: Acme Inc)",
    )
    spy.mockRestore()
  })
})
