import { BadRequestException } from "@nestjs/common"
import { z } from "zod"
import { formatIssues, SchemaValidationPipe } from "../schema-validation.pipe"

describe("formatIssues", () => {
  it("keeps a message that already names its field", () => {
    expect(
      formatIssues([{ path: ["token"], message: "token must be a 64-character hex string" }]),
    ).toEqual(["token must be a 64-character hex string"])
  })

  it("prefixes any other message with its path", () => {
    expect(formatIssues([{ path: ["ids", 0], message: "Invalid UUID" }])).toEqual([
      "ids.0: Invalid UUID",
    ])
  })

  it("keeps a message that names the top-level field of a nested path", () => {
    expect(formatIssues([{ path: ["ids", 3], message: "ids must be valid" }])).toEqual([
      "ids must be valid",
    ])
  })

  it("keeps a message that has no path", () => {
    expect(formatIssues([{ message: 'Unrecognized key: "bogus"' }])).toEqual([
      'Unrecognized key: "bogus"',
    ])
  })
})

describe("SchemaValidationPipe", () => {
  const pipe = new SchemaValidationPipe()
  const schema = z.strictObject({ page: z.coerce.number().default(1) })

  it("returns the parsed value, so defaults reach the handler", async () => {
    await expect(pipe.transform({}, { type: "query", schema })).resolves.toEqual({ page: 1 })
  })

  it("throws a 400 with one message per issue", async () => {
    const error = await pipe.transform({ bogus: 1 }, { type: "query", schema }).catch((e) => e)
    expect(error).toBeInstanceOf(BadRequestException)
    expect(error.getResponse().message).toEqual(['Unrecognized key: "bogus"'])
  })

  it.each(["body", "query"] as const)("refuses a %s parameter that has no schema", async (type) => {
    await expect(pipe.transform({}, { type })).rejects.toThrow(/has no schema/)
  })

  it("passes a path parameter through, because ParseUUIDPipe owns it", async () => {
    await expect(pipe.transform("x", { type: "param" })).resolves.toBe("x")
  })
})
