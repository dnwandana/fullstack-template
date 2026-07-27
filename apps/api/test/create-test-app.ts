import { INestApplication } from "@nestjs/common"
import { TestingModule } from "@nestjs/testing"
import { configureApp } from "../src/bootstrap"

/**
 * Boots the real application for e2e specs. `bodyParser: false` mirrors src/main.ts so the
 * parsers configureApp registers (100kb json/urlencoded) are the only ones here too — that is
 * what makes the 100kb limit real in tests.
 */
export async function createTestApp(ref: TestingModule): Promise<INestApplication> {
  const app = ref.createNestApplication({ bufferLogs: true, bodyParser: false })
  configureApp(app)
  await app.init()
  return app
}
