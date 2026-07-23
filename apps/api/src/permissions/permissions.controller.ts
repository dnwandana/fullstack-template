import { Controller, Get } from "@nestjs/common"
import { PermissionsService } from "./permissions.service"

@Controller("permissions")
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get()
  async findAll() {
    const data = await this.permissions.findAll()
    return { message: "OK", data }
  }
}
