import { request, cleanAllTables, extractCookies } from "../helpers.js"

afterEach(async () => {
  await cleanAllTables()
})

describe("POST /api/auth/signup", () => {
  it("should create a new user", async () => {
    const res = await (await request()).post("/api/auth/signup").send({
      username: "newuser",
      password: "Testpass123!",
      confirmation_password: "Testpass123!",
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
      password: "Testpass123!",
      confirmation_password: "Testpass123!",
    })

    const res = await agent.post("/api/auth/signup").send({
      username: "duplicate",
      password: "Testpass456!",
      confirmation_password: "Testpass456!",
    })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain("already exists")
  })

  it("should reject username shorter than 3 characters", async () => {
    const res = await (await request()).post("/api/auth/signup").send({
      username: "ab",
      password: "Testpass123!",
      confirmation_password: "Testpass123!",
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

  it("should reject password without complexity requirements", async () => {
    const res = await (await request()).post("/api/auth/signup").send({
      username: "complexuser",
      password: "simplepassword",
      confirmation_password: "simplepassword",
    })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/uppercase|digit|special/i)
  })

  it("should reject mismatched confirmation_password", async () => {
    const res = await (await request()).post("/api/auth/signup").send({
      username: "validuser",
      password: "Testpass123!",
      confirmation_password: "Differentpass1!",
    })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain("confirmation_password")
  })

  it("should accept optional email on signup", async () => {
    const res = await (await request()).post("/api/auth/signup").send({
      username: "emailuser",
      email: "emailuser@test.com",
      password: "Testpass123!",
      confirmation_password: "Testpass123!",
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
      password: "Testpass123!",
      confirmation_password: "Testpass123!",
    })

    const res = await agent.post("/api/auth/signup").send({
      username: "emailuser2",
      email: "same@test.com",
      password: "Testpass123!",
      confirmation_password: "Testpass123!",
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
      password: "Testpass123!",
      confirmation_password: "Testpass123!",
    })

    const res = await agent.post("/api/auth/signin").send({
      username: "loginuser",
      password: "Testpass123!",
    })

    expect(res.status).toBe(200)
    expect(res.body.data.id).toBeDefined()
    expect(res.body.data.username).toBe("loginuser")
    expect(res.headers["set-cookie"]).toBeDefined()
    const cookieHeader = res.headers["set-cookie"]
    const cookieStr = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader
    expect(cookieStr).toContain("access_token=")
    expect(cookieStr).toContain("refresh_token=")
    expect(cookieStr).toContain("HttpOnly")
    expect(res.body.data.access_token).toBeUndefined()
    expect(res.body.data.refresh_token).toBeUndefined()
  })

  it("should reject invalid password", async () => {
    const agent = await request()
    await agent.post("/api/auth/signup").send({
      username: "loginuser2",
      password: "Testpass123!",
      confirmation_password: "Testpass123!",
    })

    const res = await agent.post("/api/auth/signin").send({
      username: "loginuser2",
      password: "Wrongpass1!",
    })

    expect(res.status).toBe(401)
    expect(res.body.message).toContain("invalid credentials")
  })

  it("should reject non-existent username", async () => {
    const res = await (await request()).post("/api/auth/signin").send({
      username: "nonexistent",
      password: "Testpass123!",
    })

    expect(res.status).toBe(401)
    expect(res.body.message).toContain("invalid credentials")
  })

  it("should lock account after 5 failed attempts", async () => {
    const agent = await request()
    await agent.post("/api/auth/signup").send({
      username: "lockuser",
      password: "Testpass123!",
      confirmation_password: "Testpass123!",
    })

    // 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await agent.post("/api/auth/signin").send({
        username: "lockuser",
        password: "Wrongpass1!",
      })
    }

    // 6th attempt with correct password should be locked
    const res = await agent.post("/api/auth/signin").send({
      username: "lockuser",
      password: "Testpass123!",
    })

    expect(res.status).toBe(401)
    expect(res.body.message).toContain("invalid credentials")
  })

  it("should reset failed attempts on successful login", async () => {
    const agent = await request()
    await agent.post("/api/auth/signup").send({
      username: "resetuser",
      password: "Testpass123!",
      confirmation_password: "Testpass123!",
    })

    // 3 failed attempts (below lockout threshold)
    for (let i = 0; i < 3; i++) {
      await agent.post("/api/auth/signin").send({
        username: "resetuser",
        password: "Wrongpass1!",
      })
    }

    // Successful login should reset counter
    const res = await agent.post("/api/auth/signin").send({
      username: "resetuser",
      password: "Testpass123!",
    })

    expect(res.status).toBe(200)

    // Should be able to fail 5 more times before lockout (proves counter was reset)
    for (let i = 0; i < 4; i++) {
      await agent.post("/api/auth/signin").send({
        username: "resetuser",
        password: "Wrongpass1!",
      })
    }
    const stillOk = await agent.post("/api/auth/signin").send({
      username: "resetuser",
      password: "Testpass123!",
    })
    expect(stillOk.status).toBe(200)
  })
})

describe("POST /api/auth/refresh", () => {
  it("should return new cookies on refresh (rotation)", async () => {
    const agent = await request()
    await agent.post("/api/auth/signup").send({
      username: "refreshuser",
      password: "Testpass123!",
      confirmation_password: "Testpass123!",
    })
    const signinRes = await agent.post("/api/auth/signin").send({
      username: "refreshuser",
      password: "Testpass123!",
    })

    const cookieStr = extractCookies(signinRes)

    const res = await agent.post("/api/auth/refresh").set("Cookie", cookieStr)

    expect(res.status).toBe(200)
    expect(res.headers["set-cookie"]).toBeDefined()
    const newCookieStr = Array.isArray(res.headers["set-cookie"])
      ? res.headers["set-cookie"].join("; ")
      : res.headers["set-cookie"]
    expect(newCookieStr).toContain("access_token=")
    expect(newCookieStr).toContain("refresh_token=")
  })

  it("should reject reused refresh token (rotation)", async () => {
    const agent = await request()
    await agent.post("/api/auth/signup").send({
      username: "reuseuser",
      password: "Testpass123!",
      confirmation_password: "Testpass123!",
    })
    const signinRes = await agent.post("/api/auth/signin").send({
      username: "reuseuser",
      password: "Testpass123!",
    })

    const cookieStr = extractCookies(signinRes)

    await agent.post("/api/auth/refresh").set("Cookie", cookieStr)

    const res = await agent.post("/api/auth/refresh").set("Cookie", cookieStr)

    expect(res.status).toBe(401)
  })

  it("should reject request without refresh token", async () => {
    const res = await (await request()).post("/api/auth/refresh")

    expect(res.status).toBe(401)
  })
})

describe("POST /api/auth/logout", () => {
  it("should revoke refresh token on logout", async () => {
    const agent = await request()
    await agent.post("/api/auth/signup").send({
      username: "logoutuser",
      password: "Testpass123!",
      confirmation_password: "Testpass123!",
    })
    const signinRes = await agent.post("/api/auth/signin").send({
      username: "logoutuser",
      password: "Testpass123!",
    })

    const cookieStr = extractCookies(signinRes)

    const logoutRes = await agent.post("/api/auth/logout").set("Cookie", cookieStr)
    expect(logoutRes.status).toBe(200)

    const refreshRes = await agent.post("/api/auth/refresh").set("Cookie", cookieStr)
    expect(refreshRes.status).toBe(401)
  })

  it("should return 401 without refresh token cookie", async () => {
    const agent = await request()
    const res = await agent.post("/api/auth/logout")

    expect(res.status).toBe(401)
  })
})

describe("GET /api/auth/me", () => {
  it("should return current user with valid access token", async () => {
    const agent = await request()
    await agent.post("/api/auth/signup").send({
      username: "meuser",
      password: "Testpass123!",
      confirmation_password: "Testpass123!",
    })
    const signinRes = await agent.post("/api/auth/signin").send({
      username: "meuser",
      password: "Testpass123!",
    })

    const cookieStr = extractCookies(signinRes)

    const res = await agent.get("/api/auth/me").set("Cookie", cookieStr)

    expect(res.status).toBe(200)
    expect(res.body.data.id).toBeDefined()
    expect(res.body.data.username).toBe("meuser")
  })

  it("should return 401 without access token", async () => {
    const res = await (await request()).get("/api/auth/me")

    expect(res.status).toBe(401)
  })

  it("should return 401 with invalid access token", async () => {
    const agent = await request()

    const res = await agent.get("/api/auth/me").set("Cookie", "access_token=invalidtoken")

    expect(res.status).toBe(401)
  })
})
