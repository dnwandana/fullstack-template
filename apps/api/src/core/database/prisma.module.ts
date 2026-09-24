import { Global, Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { PrismaService } from "./prisma.service"

@Global()
@Module({
  // PrismaService reads DATABASE_URL through ConfigService. The import lets a test module that
  // loads only PrismaModule resolve it too.
  imports: [ConfigModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
