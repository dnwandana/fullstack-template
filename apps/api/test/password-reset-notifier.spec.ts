import { ConfigService } from "@nestjs/config"
import { PasswordResetNotifierService } from "../src/auth/password-reset-notifier.service"

function stubConfig(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService
}

type WithLogger = { logger: { log: (msg: string) => void; debug: (msg: string) => void } }

describe("PasswordResetNotifierService", () => {
  // The email address is PII. The always-on info line must identify the user by id;
  // the address may appear only in the dev-gated debug output, like the raw token.
  it("logs the user id, never the email address", () => {
    const notifier = new PasswordResetNotifierService(stubConfig({ NODE_ENV: "production" }))
    const log = jest
      .spyOn((notifier as unknown as WithLogger).logger, "log")
      .mockImplementation(() => {})

    notifier.sendResetEmail({
      email: "somebody@example.com",
      rawToken: "a".repeat(64),
      userId: "11111111-2222-3333-4444-555555555555",
    })

    expect(log).toHaveBeenCalledTimes(1)
    const line = log.mock.calls[0][0]
    expect(line).not.toContain("somebody@example.com")
    expect(line).toContain("11111111-2222-3333-4444-555555555555")
  })

  it("still logs the reset URL only in development", () => {
    const notifier = new PasswordResetNotifierService(
      stubConfig({ NODE_ENV: "development", APP_BASE_URL: "http://localhost:8080" }),
    )
    const debug = jest
      .spyOn((notifier as unknown as WithLogger).logger, "debug")
      .mockImplementation(() => {})
    jest.spyOn((notifier as unknown as WithLogger).logger, "log").mockImplementation(() => {})

    notifier.sendResetEmail({ email: "dev@x.io", rawToken: "b".repeat(64), userId: "u-1" })

    expect(debug).toHaveBeenCalledWith(
      `Reset URL: http://localhost:8080/reset-password?token=${"b".repeat(64)}`,
    )
  })
})
