import { INestApplication } from "@nestjs/common"
import request from "supertest"
import { PrismaService } from "@core/database/prisma.service"

let counter = 0

export async function signupAndSignin(
  app: INestApplication,
  creds?: { name?: string; email?: string; password?: string },
): Promise<{ userId: string; cookies: string[]; email: string }> {
  const email = creds?.email ?? `user${++counter}@x.io`
  const password = creds?.password ?? "Str0ng!pass"
  const name = creds?.name ?? `User ${counter}`
  const server = app.getHttpServer()
  const signup = await request(server)
    .post("/api/v1/auth/signup")
    .send({ name, email, password, confirmation_password: password })
  const userId = signup.body.data.id as string
  const signin = await request(server).post("/api/v1/auth/signin").send({ email, password })
  const cookies = signin.headers["set-cookie"] as unknown as string[]
  return { userId, cookies, email }
}

export async function createOrg(
  app: INestApplication,
  cookies: string[],
  name = "Acme",
): Promise<{ id: string }> {
  const res = await request(app.getHttpServer())
    .post("/api/v1/orgs")
    .set("Cookie", cookies)
    .send({ name })
  return { id: res.body.data.id as string }
}

export async function getRoleId(
  prisma: PrismaService,
  orgId: string,
  roleName: string,
): Promise<string> {
  const role = await prisma.role.findFirstOrThrow({
    where: { orgId, name: roleName },
    select: { id: true },
  })
  return role.id
}
