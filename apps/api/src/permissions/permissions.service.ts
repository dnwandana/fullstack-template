import { Injectable } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { toSnakeKeys } from "../common/to-snake-keys"

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const rows = await this.prisma.permission.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        resource: true,
        action: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    })
    // API responses keep the Express-era snake_case contract the SPA consumes.
    return rows.map((row) => toSnakeKeys(row))
  }
}
