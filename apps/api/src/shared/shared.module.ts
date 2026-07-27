import { Module } from "@nestjs/common"
import { PaginationService } from "./pagination/pagination.service"

// Deliberately NOT @Global(): the explicit import is the point. A feature that
// needs pagination must say so, which turns a forgotten dependency into a
// compile-time module error instead of a runtime unresolved-dependency crash.
@Module({
  providers: [PaginationService],
  exports: [PaginationService],
})
export class SharedModule {}
