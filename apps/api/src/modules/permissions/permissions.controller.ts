import { Controller, Get } from "@nestjs/common"
import { PermissionsService } from "./permissions.service"

/** Reference endpoint for the canonical permission list; not tenant-scoped. */
@Controller("permissions")
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  // Every permission a role can be granted, name-ascending.
  @Get()
  async findAll() {
    const data = await this.permissions.findAll()
    return { message: "OK", data }
  }
}
