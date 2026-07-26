import { INestApplication } from "@nestjs/common"
import { TestingModule } from "@nestjs/testing"
import { configureApp } from "../src/bootstrap"

// bodyParser: false mirrors src/main.ts — the parsers registered in configureApp
// (100kb json/urlencoded) must be the only ones, in tests as in production.
export async function createTestApp(ref: TestingModule): Promise<INestApplication> {
  const app = ref.createNestApplication({ bufferLogs: true, bodyParser: false })
  configureApp(app)
  await app.init()
  return app
}
