import { Test } from "@nestjs/testing"
import { SharedModule } from "./shared.module"
import { PaginationService } from "./pagination/pagination.service"

describe("SharedModule", () => {
  it("exports a single shared PaginationService instance", async () => {
    const moduleRef = await Test.createTestingModule({ imports: [SharedModule] }).compile()
    const a = moduleRef.get(PaginationService)
    const b = moduleRef.get(PaginationService)
    expect(a).toBeInstanceOf(PaginationService)
    expect(a).toBe(b)
  })
})
