import "reflect-metadata"
import { ConfigService } from "@nestjs/config"
import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"
import { configureApp } from "./bootstrap"

async function bootstrap() {
  // bodyParser: false — configureApp registers the only (100kb) parsers; letting
  // NestFactory add its defaults first would make that limit dead configuration.
  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false })
  configureApp(app)
  // PORT through ConfigService — Joi owns the 3000 default; no duplicated literal here.
  await app.listen(app.get(ConfigService).getOrThrow<number>("PORT"))
}
bootstrap().catch((err) => {
  // bufferLogs holds startup output until a logger attaches — if create() itself
  // rejects (e.g. env validation), that buffer is lost; this is the only trace.
  console.error(err)
  process.exit(1)
})
