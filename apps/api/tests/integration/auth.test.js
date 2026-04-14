import { request, cleanAllTables } from "../helpers.js"

afterEach(async () => {
  await cleanAllTables()
})

describe("POST /api/auth/signup", () => {
  it("should create a new user", async () => {
    const res = await (await request()).post("/api/auth/signup").send({
      username: "newuser",
      password: "password123",
      confirmation_password: "password123",
    })

    expect(res.status).toBe(201)
    expect(res.body.message).toBe("Created")
    expect(res.body.data.id).toBeDefined()
    expect(res.body.data.username).toBe("newuser")
  })

  it("should reject duplicate username", async () => {
    const agent = await request()
    await agent.post("/api/auth/signup").send({
      username: "duplicate",
      password: "password123",
      confirmation_password: "password123",
    })

    const res = await agent.post("/api/auth/signup").send({
      username: "duplicate",
      password: "password456",
      confirmation_password: "password456",
    })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain("already exists")
  })

  it("should reject username shorter than 3 characters", async () => {
    const res = await (await request()).post("/api/auth/signup").send({
      username: "ab",
      password: "password123",
      confirmation_password: "password123",
    })

    expect(res.status).toBe(400)
  })

  it("should reject password shorter than 8 characters", async () => {
    const res = await (await request()).post("/api/auth/signup").send({
      username: "validuser",
      password: "short",
      confirmation_password: "short",
    })

    expect(res.status).toBe(400)
  })

  it("should reject mismatched confirmation_password", async () => {
    const res = await (await request()).post("/api/auth/signup").send({
      username: "validuser",
      password: "password123",
      confirmation_password: "differentpassword",
    })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain("confirmation_password")
  })

  it("should accept optional email on signup", async () => {
    const res = await (await request()).post("/api/auth/signup").send({
      username: "emailuser",
      email: "emailuser@test.com",
      password: "password123",
      confirmation_password: "password123",
    })

    expect(res.status).toBe(201)
    expect(res.body.data.username).toBe("emailuser")
    expect(res.body.data.email).toBe("emailuser@test.com")
  })

  it("should reject duplicate email", async () => {
    const agent = await request()
    await agent.post("/api/auth/signup").send({
      username: "emailuser1",
      email: "same@test.com",
      password: "password123",
      confirmation_password: "password123",
    })

    const res = await agent.post("/api/auth/signup").send({
      username: "emailuser2",
      email: "same@test.com",
      password: "password123",
      confirmation_password: "password123",
    })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain("email")
  })
})

describe("POST /api/auth/signin", () => {
  it("should sign in with valid credentials", async () => {
    const agent = await request()
    await agent.post("/api/auth/signup").send({
      username: "loginuser",
      password: "password123",
      confirmation_password: "password123",
    })

    const res = await agent.post("/api/auth/signin").send({
      username: "loginuser",
      password: "password123",
    })

    expect(res.status).toBe(200)
    expect(res.body.data.id).toBeDefined()
    expect(res.body.data.username).toBe("loginuser")
    expect(res.body.data.access_token).toBeDefined()
    expect(res.body.data.refresh_token).toBeDefined()
  })

  it("should reject invalid password", async () => {
    const agent = await request()
    await agent.post("/api/auth/signup").send({
      username: "loginuser2",
      password: "password123",
      confirmation_password: "password123",
    })

    const res = await agent.post("/api/auth/signin").send({
      username: "loginuser2",
      password: "wrongpassword",
    })

    expect(res.status).toBe(401)
    expect(res.body.message).toContain("invalid credentials")
  })

  it("should reject non-existent username", async () => {
    const res = await (await request()).post("/api/auth/signin").send({
      username: "nonexistent",
      password: "password123",
    })

    expect(res.status).toBe(401)
    expect(res.body.message).toContain("invalid credentials")
  })
})

describe("POST /api/auth/refresh", () => {
  it("should return a new access token", async () => {
    const agent = await request()
    await agent.post("/api/auth/signup").send({
      username: "refreshuser",
      password: "password123",
      confirmation_password: "password123",
    })
    const signinRes = await agent.post("/api/auth/signin").send({
      username: "refreshuser",
      password: "password123",
    })

    const refreshToken = signinRes.body.data.refresh_token

    const res = await agent.post("/api/auth/refresh").set("x-refresh-token", refreshToken)

    expect(res.status).toBe(200)
    expect(res.body.data.access_token).toBeDefined()
  })

  it("should reject request without refresh token", async () => {
    const res = await (await request()).post("/api/auth/refresh")

    expect(res.status).toBe(401)
  })
})
