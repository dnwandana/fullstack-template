import { Injectable } from "@nestjs/common"
import { PrismaService } from "@core/database/prisma.service"
import { toSnakeKeys } from "@shared/utils/to-snake-keys"

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every permission row, ordered by name. */
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
